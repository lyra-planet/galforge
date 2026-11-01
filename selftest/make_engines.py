#!/usr/bin/env python3
"""给 good/ old/ badengine/ 配引擎（剧本都用 good/story）：
  good/       当前 skill 的 starter
  old/        改版前的 starter 快照（旧引擎：playtest 应只打印「跳过」）
  badengine/  旧 starter 故意改坏：认得 n.timeout 却选第一项、章节快照只存不恢复、存档失败还说「已存到」；music.js 的 AMB 少 waves、night 抛错
"""
import shutil, sys
from pathlib import Path

T = Path(__file__).resolve().parent
NEW = T.parent / "assets" / "starter"
OLD = T / "old_starter"  # 改版前的引擎快照，只留 index.html、music.js；美术三个夹具都用当前的 pixel_art.js
TAGS = '<script src="story/ch1.js"></script>\n<script src="story/ch2.js"></script>'


def rep(s, a, b):
    assert s.count(a) == 1, a
    return s.replace(a, b)


def build(name, src, patch_html=None, patch_music=None):
    d = T / name
    if name != "good":
        shutil.rmtree(d, ignore_errors=True)
        shutil.copytree(T / "good" / "story", d / "story")
    shutil.copy(NEW / "pixel_art.js", d / "pixel_art.js")
    html = rep((src / "index.html").read_text("utf8"), '<script src="story/ch1.js"></script>', TAGS)
    music = (src / "music.js").read_text("utf8")
    (d / "index.html").write_text(patch_html(html) if patch_html else html, "utf8")
    (d / "music.js").write_text(patch_music(music) if patch_music else music, "utf8")


def bad_html(s):
    s = rep(s, "choiceT = setTimeout(() => choose(vis[0]), n.timer * 1000);",
            "choiceT = setTimeout(() => { const to = n.timeout; choose(vis[0]); }, n.timer * 1000); // 埋错：认得 n.timeout 却还是选第一项")
    s = rep(s, "  S.ch = id; S.flags = [];",
            "  S.snap = S.snap || {}; if (!S.snap[id]) S.snap[id] = { vars: Object.assign({}, S.vars) }; // 埋错：章节快照只存不恢复\n  S.ch = id; S.flags = [];")
    s = rep(s, "set(k, v) { try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) {} },",
            'set(k, v) { try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) { console.log("存档失败"); } }, // 埋错：失败了不告诉玩家，手动存档照样说「已存到」')
    return s


def bad_music(s):
    s = rep(s, "  root.Music = { play, sfx,",
            "  const AMB = { rain: {}, cicada: {}, wind: {}, crowd: {}, night: {}, clock: {} }; // 埋错：少了 waves\n"
            "  function amb(name) { if (!init()) return; if (name === \"night\") undefinedAmbFn(); } // 埋错：night 一放就抛错\n"
            "  root.Music = { amb, AMB, play, sfx,")
    return s


build("good", NEW)
build("old", OLD)
build("badengine", OLD, bad_html, bad_music)
print("engines ready:", ", ".join(p.name for p in (T / "good", T / "old", T / "badengine")))
