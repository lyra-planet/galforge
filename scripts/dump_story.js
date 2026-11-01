#!/usr/bin/env node
/* 把剧本压成紧凑的纯文本，给一致性审读的 agent 读（比读原始 JS 省一半以上）。
 * node tools/dump_story.js [ch1 ch2 …]，不带参数输出全部章节；游戏目录 = $GAME_DIR，没设就是本脚本的上一级
 * 每个节点一段：## id [时间 场景] 进节点时的效果（站位、转场、配乐、环境音、fx……）→ 台词 → 结尾（→ 跳转 / ? 选项 / ⇢ 条件跳转 / ■ 结束）
 * 台词括号里带它的条件（「仅当 …」的行条件不满足时整行不出现）、fx、进退场、句中换的配乐 / 环境音；文字标记原样保留
 */
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = process.env.GAME_DIR || path.join(__dirname, "..");
const DIR = path.join(ROOT, "story");
const R = require(path.join(DIR, "registry.js"));
const arr = v => (v == null ? [] : Array.isArray(v) ? v : [v]);
const want = process.argv.slice(2);
const files = fs.readdirSync(DIR).filter(f => /^ch\w*\.js$/.test(f)).sort((a, b) => (+(a.match(/\d+/) || [0])[0]) - (+(b.match(/\d+/) || [0])[0]) || a.localeCompare(b));
const tags = o => [arr(o.need).length && `需要 ${arr(o.need).join("+")}`, arr(o.needNot).length && `没有 ${arr(o.needNot).join("/")} 才出现`,
  arr(o.clue).length && `得线索 ${arr(o.clue).join(" ")}`, arr(o.set).length && `设 ${arr(o.set).join(" ")}`,
  o.add && Object.keys(o.add).length && `好感 ${Object.entries(o.add).map(([k, v]) => k + (v >= 0 ? "+" : "") + v).join(" ")}`].filter(Boolean).join("，");
const stageText = st => (Object.keys(st).length ? Object.entries(st).map(([p, sp]) => `${p}:${sp}`).join(" ") : "清空");
const bgmText = b => { const id = b && typeof b === "object" ? b.id : b, fade = b && typeof b === "object" && b.fade != null ? `，淡入 ${b.fade} 秒` : ""; return id === "none" ? "配乐停（淡出）" : `配乐 ${id}${fade}`; };
const transText = t => `转场 ${t && typeof t === "object" ? `${t.kind}${t.ms != null ? " " + t.ms + "ms" : ""}` : t}`;
const ambText = a => (a === "none" ? "环境音停" : `环境音 ${a}`);
const audio = o => [o.trans != null && transText(o.trans), o.bgm != null && bgmText(o.bgm), o.bgmVol != null && `音乐压到 ${o.bgmVol}`, o.amb != null && ambText(o.amb)];
for (const f of files) {
  const chs = []; vm.runInNewContext(fs.readFileSync(path.join(DIR, f), "utf8"), { STORY: { chapter: c => chs.push(c) } });
  for (const c of chs) {
    if (want.length && !want.includes(c.id)) continue;
    console.log(`# ${c.id}《${c.title}》 起点 ${c.start}\n`);
    let time = "";
    for (const [id, n] of Object.entries(c.nodes)) {
      if (n.time) time = n.time;
      const fx = [n.stage && `站位 ${stageText(n.stage)}`, n.tod && `时段 ${n.tod}`, n.weather && `天气 ${n.weather}`, n.props && `开关 ${JSON.stringify(n.props)}`, ...audio(n), n.sfx && `音效 ${n.sfx}`, n.fx && `效果 ${n.fx}`, n.title && `标题卡「${arr(n.title).join(" · ")}」`, tags(n)].filter(Boolean).join("，");
      const tm = n.time || (time ? "（" + time + "）" : "");
      console.log(`## ${id} [${tm ? tm + " " : ""}${n.scene}]${fx ? " " + fx : ""}`);
      for (const [who, text, ex, o] of n.lines || []) {
        const sp = who === "" ? "·" : (R.SPEAKERS[who] || {}).name || who;
        const op = o == null ? {} : o === "off" ? { off: 1 } : typeof o === "string" ? { emote: o } : o;
        const tag = [arr(op.need).length && `仅当 ${arr(op.need).join("+")}`, arr(op.needNot).length && `没有 ${arr(op.needNot).join("/")} 才说`,
          ex, op.off && "画外", op.emote && "符号 " + op.emote, op.jump && "蹦", op.outfit && "换 " + op.outfit, op.weather && "天气 " + op.weather, op.props && "开关 " + JSON.stringify(op.props),
          op.sfx && "音效 " + op.sfx, op.fx && "效果 " + op.fx, ...audio(op), op.stage && "站位 " + stageText(op.stage), op.enter && `从${op.enter === "left" ? "左" : "右"}边进`, op.exit && `往${op.exit === "left" ? "左" : "右"}边出`].filter(Boolean).join("，");
        console.log(`   ${sp}${tag ? `（${tag}）` : ""}: ${text}`);
      }
      if (n.next) console.log(`   → ${n.next}`);
      for (const o of n.choices || []) console.log(`   ? 选项 ${o.t} → ${o.next}${tags(o) ? `（${tags(o)}）` : ""}`);
      if (n.timer) console.log(`   ? 限时 ${n.timer} 秒，${n.timeout ? `超时 → ${n.timeout.next}${tags(n.timeout) ? `（${tags(n.timeout)}）` : ""}` : "超时选第一个"}`);
      for (const b of n.branch || []) { const cond = [arr(b.need).length && "有 " + arr(b.need).join("+"), arr(b.needNot).length && "没有 " + arr(b.needNot).join("/")].filter(Boolean).join("、"); console.log(`   ⇢ ${cond ? "如果" + cond : "否则"} → ${b.next}`); }
      if (n.end) console.log(`   ■ ${n.end.type === "ending" ? `结局 ${n.end.id}《${(R.ENDINGS[n.end.id] || {}).name}》` : n.end.type === "retry" || n.end.retry ? "失败，重来本章" : "本章结束"}`);
      console.log("");
    }
  }
}
