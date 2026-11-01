#!/usr/bin/env python3
"""真浏览器自动通关：无头 Chromium 打开 index.html，随机点到结局，一路收集报错、按间隔截图。

要装了 playwright 的 python（pip install playwright && playwright install chromium）：
  python tools/browser_play.py --out <截图目录> [--runs 2] [--width 1280] [--steps 600] [--every 60] [--seed 1] [--audit]

- 用 playwright 的假时钟（page.clock）；每步只快进 0.4 秒，打字机和标题卡都靠按空格跳过（引擎本来就支持），
  比等它们自己走完快一倍多：快进的假时间越长越慢，大约 0.35 秒真实时间 / 1 秒假时间，和画面画多少帧关系不大
- 抓 playtest 的假 DOM 抓不到的：真实 CSS 布局、字体、canvas 绘制、浏览器里才会抛的错
- --audit：触控尺寸审计，在标题页、对话、菜单、选项、选章、结局各量一次看得见的按钮，小于 24×24 报错（WCAG 2.5.8）、小于 44 提醒；
  --width ≤ 480（手机）时默认开，--no-audit 关
- 退出码：有页面报错、卡死、超步数或触控尺寸报错 = 1
游戏目录 = $GAME_DIR，没设就是本脚本的上一级
"""
import argparse, os, random, sys
from pathlib import Path

ROOT = Path(os.environ.get("GAME_DIR") or Path(__file__).resolve().parent.parent)
from playwright.sync_api import sync_playwright  # noqa: E402

STATE = """() => {
  const v = id => { const e = document.getElementById(id); return !!e && !e.hidden; };
  const t = id => (document.getElementById(id) || {}).textContent || "";
  return { ending: v("ending"), hub: v("hub"), choices: v("choices"), card: v("card"),
           txt: t("txt"), name: t("name"), cardH: t("cardH"), endTag: t("endTag"), endName: t("endName") };
}"""
OPTIONAL = ("audio/voice/manifest.js",)  # 没配音时本来就没有
# 标题卡只显示 1.9 秒，会被快进跳过：页面加载前挂一个观察器，标题卡一出现就记下文字
# 看得见的按钮和尺寸（触控审计用）
BUTTONS = """() => [...document.querySelectorAll("button, [role=button], .choice")].map(b => {
  const r = b.getBoundingClientRect(), cs = getComputedStyle(b);
  if (r.width < 1 || r.height < 1 || cs.visibility === "hidden" || +cs.opacity === 0) return null;
  const name = b.id ? "#" + b.id : (b.className ? "." + String(b.className).split(" ")[0] : b.tagName.toLowerCase()) + "「" + (b.textContent || "").trim().slice(0, 8) + "」";
  return { k: name, w: Math.round(r.width), h: Math.round(r.height) };
}).filter(Boolean)"""
CARD_SPY = """new MutationObserver(ms => { for (const m of ms) if (m.target.id === "card" && !m.target.hidden)
  (window.__cards = window.__cards || []).push((document.getElementById("cardH") || {}).textContent + " " + (document.getElementById("cardP") || {}).textContent);
}).observe(document, { subtree: true, attributes: true, attributeFilter: ["hidden"] });"""


def measure(pg, where, found):
    """量一遍看得见的按钮，每个按钮记最小的那次"""
    for b in pg.evaluate(BUTTONS):
        if b["k"] not in found or min(b["w"], b["h"]) < min(found[b["k"]][:2]):
            found[b["k"]] = (b["w"], b["h"], where)


def open_menu(pg, audit):
    """打开菜单量一次，再关掉（Esc 关不掉就直接藏起来）"""
    if not pg.evaluate("() => { const b = document.getElementById('bMenu'); return !!b && b.getBoundingClientRect().width > 0; }"):
        return
    pg.click("#bMenu")
    pg.clock.run_for(200)
    audit("菜单")
    pg.keyboard.press("Escape")
    pg.evaluate("() => { const m = document.getElementById('menuOv'); if (m) m.hidden = true; }")


def play(pg, rnd, steps, every, snap, from_title=True, audit=None):
    if from_title:
        pg.click("#bNew")
    last, same, shot_choice = None, 0, False
    seen = set()  # 触控审计：每种画面量一次
    def once(tag):
        if audit and tag not in seen:
            seen.add(tag); audit(tag)
    for i in range(steps):
        pg.clock.run_for(400)  # 够章节切换的 300ms 过渡；打字机、标题卡下面按空格跳过
        s = pg.evaluate(STATE)
        if every and i % every == 0:
            snap(f"step{i:04d}")
        if s["ending"]:
            snap("ending"); once("结局")
            return f"{s['endTag']} {s['endName']}".strip(), i
        if s["hub"]:
            snap("hub"); once("选章")
            rnd.choice(pg.query_selector_all("#hubGrid .cell:not([disabled])")).click()
            continue
        if s["choices"]:
            if not shot_choice:
                snap("choices"); shot_choice = True
            once("选项")
            btns = pg.query_selector_all("#choices .choice")
            clue = [b for b in btns if "clue" in (b.get_attribute("class") or "")]
            (rnd.choice(clue) if clue and rnd.random() < 0.7 else rnd.choice(btns)).click()
            continue
        if audit and i > 2 and "对话" not in seen and not s["card"]:
            once("对话")
            open_menu(pg, audit)
        key = (s["txt"], s["name"], s["card"])
        same = same + 1 if key == last else 0
        last = key
        if same > 40:
            snap("stuck")
            return f"STUCK「{s['txt'][:20]}」", i
        pg.evaluate("document.activeElement && document.activeElement.blur && document.activeElement.blur()")
        pg.keyboard.press("Space")
    return "TOO_LONG", steps


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True, help="截图目录")
    ap.add_argument("--runs", type=int, default=2)
    ap.add_argument("--width", type=int, default=1280, help="1280 = 桌面，400 = 手机竖屏")
    ap.add_argument("--steps", type=int, default=600)
    ap.add_argument("--every", type=int, default=60, help="每多少步截一张，0 = 只截选项、hub、结局")
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--ch", default=None, help="直接从某一章开局（用引擎的 ?ch= 调试入口），比如只测随机从头玩很难走到的那一章")
    ap.add_argument("--audit", action=argparse.BooleanOptionalAction, default=None, help="触控尺寸审计；--width ≤ 480 时默认开")
    a = ap.parse_args()
    if a.audit is None:
        a.audit = a.width <= 480
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    size = {"width": a.width, "height": 860 if a.width < 700 else round(a.width * 9 / 16)}
    proxy = os.environ.get("https_proxy") or os.environ.get("HTTPS_PROXY")  # 设了 https_proxy 时浏览器也走它
    bad, found = 0, {}  # found：按钮 → (宽, 高, 在哪量的)
    with sync_playwright() as p:
        br = p.chromium.launch(proxy={"server": proxy} if proxy else None)
        for r in range(a.runs):
            pg = br.new_page(viewport=size)
            errs, missing = [], []
            pg.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
            pg.on("console", lambda m: m.type == "error" and "Failed to load resource" not in m.text and errs.append(f"console: {m.text}"))
            pg.on("requestfailed", lambda q: not q.url.endswith(OPTIONAL) and missing.append(q.url.split("/")[-1]))
            pg.add_init_script(CARD_SPY)
            pg.clock.install()
            pg.goto((ROOT / "index.html").resolve().as_uri() + (f"?ch={a.ch}" if a.ch else ""), wait_until="load", timeout=60000)
            tag0 = f"w{a.width}_{a.ch + '_' if a.ch else ''}run{r}"
            snap = lambda tag, pg=pg, tag0=tag0: pg.screenshot(path=str(out / f"{tag0}_{tag}.png"))
            audit = (lambda where, pg=pg: measure(pg, where, found)) if a.audit else None
            if audit and not a.ch:
                pg.clock.run_for(400); audit("标题页")
            res, n = play(pg, random.Random(a.seed + r * 7919), a.steps, a.every, snap, from_title=not a.ch, audit=audit)
            cards = pg.evaluate("window.__cards || []")
            if errs or missing or not res.startswith(("结局", "完")):
                bad += 1
            print(f"run {r}: {res} · {n} 步 · 标题卡 {' / '.join(cards)}")
            for e in sorted(set(errs))[:8]:
                print("   ", e[:300])
            if missing:
                print("    缺文件:", " ".join(sorted(set(missing))))
            pg.close()
        br.close()
    print(f"截图在 {out}；{a.runs - bad}/{a.runs} 局干净")
    if a.audit:
        small = sorted((k, v) for k, v in found.items() if min(v[:2]) < 24)
        mid = sorted((k, v) for k, v in found.items() if 24 <= min(v[:2]) < 44)
        show = lambda xs: "、".join(f"{k} {w}×{h}（{where}）" for k, (w, h, where) in xs)
        print(f"触控尺寸（宽 {a.width}）：量了 {len(found)} 个按钮，{len(small)} 个小于 24×24，{len(mid)} 个小于 44")
        if small:
            print(f"  ✗ {show(small)}")
        if mid:
            print(f"  ! {show(mid)}")
        if small:
            bad += 1
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
