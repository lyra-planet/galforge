#!/usr/bin/env node
/* 从 story/ch*.js 提取需要配音的台词，输出 JSON 到 stdout
 * key = 节点id_行号；registry 里 voice 为 null 的说话人不配音；纯省略号不配音；送 TTS 前去掉括号里的动作说明和文字标记（{w} {slow}…{/slow} 等）
 * 带 need 的条件台词也照样配（玩家可能看到）
 * 游戏目录 = $GAME_DIR，没设就是本脚本的上一级
 */
const fs = require("fs"), path = require("path"), vm = require("vm");
const dir = path.join(process.env.GAME_DIR || path.join(__dirname, ".."), "story");
const R = require(path.join(dir, "registry.js"));
const out = [];
for (const f of fs.readdirSync(dir).filter(f => /^ch\w*\.js$/.test(f)).sort((a, b) => (+(a.match(/\d+/) || [0])[0]) - (+(b.match(/\d+/) || [0])[0]) || a.localeCompare(b))) {
  const chs = []; vm.runInNewContext(fs.readFileSync(path.join(dir, f), "utf8"), { STORY: { chapter: c => chs.push(c) } });
  for (const ch of chs) for (const [id, n] of Object.entries(ch.nodes)) (n.lines || []).forEach((l, i) => {
    const sp = R.SPEAKERS[l[0]]; if (!sp || !sp.voice) return;
    const speak = l[1].replace(/\{\/?\w*(?:=[^{}]*)?\}/g, "").replace(/[（(][^）)]*[）)]/g, "").replace(/[“”]/g, "").trim();
    if (!speak || /^[.…。，、！？!?\s—-]+$/.test(speak)) return;
    out.push({ key: `${id}_${i}`, ch: ch.id, speaker: l[0], voice: sp.voice, text: speak });
  });
}
process.stdout.write(JSON.stringify(out, null, 0));
