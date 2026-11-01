#!/usr/bin/env python3
"""批量配音：python3 tools/tts_batch.py [--workers 3] [--gap 0.25]

1. 调 extract_lines.js 拿到所有要配音的台词
2. 用 $TTS_CMD 逐条合成（限速；429 / 限流 / 网络错误自动退避重试）
3. 转成 mp3（ffmpeg），存到 audio/voice/<key>.mp3
4. 写 audio/voice/manifest.json（文本指纹 + 时长）和 manifest.js（引擎读：window.VOICE = {key: 秒数}）

已经存在且文本没变的条目会跳过，可以反复运行。

TTS_CMD：任意命令行 TTS 的模板，{text} {voice} {out} 三个占位符会被替换，{out} 是要写出的音频文件（wav / mp3 都行）
  例：TTS_CMD='<你的 TTS 命令> --text {text} --voice {voice} --out {out}'
  key 由 TTS 客户端自己读，不经过本脚本。用谁的客户端和 key，开工前问用户。
游戏目录 = $GAME_DIR，没设就是本脚本的上一级（脚本放在 <游戏>/tools/ 下）
"""
import argparse, concurrent.futures as cf, hashlib, json, os, shlex, subprocess, sys, tempfile, threading, time
from pathlib import Path

ROOT = Path(os.environ.get("GAME_DIR") or Path(__file__).resolve().parent.parent)
OUT = ROOT / "audio" / "voice"
lock = threading.Lock()
last_call = [0.0]


def fp(item):
    return hashlib.md5(f"{item['voice']}|{item['text']}".encode()).hexdigest()[:10]


def throttle(gap):
    with lock:
        wait = last_call[0] + gap - time.time()
        if wait > 0:
            time.sleep(wait)
        last_call[0] = time.time()


def retryable(msg):
    # 4xx 里只有 429 值得重试；其余错误（5xx、超时、连接断开）都重试
    return "429" in msg or "Throttling" in msg or "HTTP 4" not in msg  # 各家限流报错不一样，按用的服务加


def one(item, tmpl, gap):
    dest = OUT / f"{item['key']}.mp3"
    for attempt in range(8):
        throttle(gap)
        with tempfile.TemporaryDirectory() as td:
            raw = Path(td) / "raw.wav"
            argv = [a.replace("{text}", item["text"]).replace("{voice}", item["voice"]).replace("{out}", str(raw)) for a in tmpl]
            r = subprocess.run(argv, capture_output=True, text=True)
            msg = (r.stderr or "") + (r.stdout or "")
            if r.returncode != 0 or not raw.exists():
                if retryable(msg):
                    time.sleep(min(30, 2 * (attempt + 1)))
                    continue
                return item["key"], 0, msg.strip()[-200:]
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw), "-ac", "1", "-b:a", "48k", str(dest)], check=True)
        dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(dest)],
                             capture_output=True, text=True).stdout.strip()
        return item["key"], round(float(dur or 0), 2), None
    return item["key"], 0, "重试次数用完"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--gap", type=float, default=0.25, help="两次请求之间的最小间隔（秒）")
    args = ap.parse_args()
    if not os.environ.get("TTS_CMD"):
        sys.exit("请先设置 TTS_CMD，例：TTS_CMD='<你的 TTS 命令> --text {text} --voice {voice} --out {out}'")
    tmpl = shlex.split(os.environ["TTS_CMD"])
    OUT.mkdir(parents=True, exist_ok=True)
    items = json.loads(subprocess.run(["node", str(Path(__file__).resolve().parent / "extract_lines.js")], capture_output=True, text=True,
                                      check=True, env={**os.environ, "GAME_DIR": str(ROOT)}).stdout)
    man_path = OUT / "manifest.json"
    man = json.loads(man_path.read_text()) if man_path.exists() else {}
    todo = [it for it in items if man.get(it["key"], {}).get("fp") != fp(it) or not (OUT / f"{it['key']}.mp3").exists()]
    print(f"共 {len(items)} 条台词，需要合成 {len(todo)} 条", flush=True)
    done = fails = 0
    with cf.ThreadPoolExecutor(args.workers) as ex:
        futs = {ex.submit(one, it, tmpl, args.gap): it for it in todo}
        for f in cf.as_completed(futs):
            it = futs[f]; key, dur, err = f.result()
            if err:
                fails += 1; print(f"  ✗ {key}: {err}", flush=True)
            else:
                done += 1; man[key] = {"fp": fp(it), "dur": dur}
                if done % 20 == 0:
                    print(f"  … {done}/{len(todo)}", flush=True)
                    man_path.write_text(json.dumps(man, ensure_ascii=False))
    valid = {it["key"] for it in items}
    man = {k: v for k, v in man.items() if k in valid}
    man_path.write_text(json.dumps(man, ensure_ascii=False))
    (OUT / "manifest.js").write_text("window.VOICE = " + json.dumps({k: v["dur"] for k, v in man.items()}) + ";\n")
    print(f"完成：新合成 {done} 条，失败 {fails} 条，清单共 {len(man)} 条", flush=True)


if __name__ == "__main__":
    main()
