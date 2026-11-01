#!/usr/bin/env node
/* 旧作指纹比对：从剧本里读出结构上的指纹，和作品目录里的其他游戏比，结构撞了就提醒。
 *   node tools/fingerprint.js                 本作 = 本脚本的上一级（或 $GAME_DIR）；旧作 = 作品目录下其他项目的 output/game
 *   node tools/fingerprint.js <游戏目录> …     只比这几个（第一个当本作）
 * 题材、人物、钩子这些读不出来的轴，在作品目录的 FINGERPRINTS.md 里手填（references/ideation.md）。
 */
const fs = require("fs"), path = require("path"), vm = require("vm");
const args = process.argv.slice(2);
const SELF = path.resolve(args[0] || process.env.GAME_DIR || path.join(__dirname, ".."));
const WORKS = path.resolve(SELF, "..", "..", ".."); // <作品目录>/<项目>/output/game
const others = args.length > 1 ? args.slice(1).map(p => path.resolve(p))
  : (fs.existsSync(WORKS) ? fs.readdirSync(WORKS).map(d => path.join(WORKS, d, "output", "game")).filter(g => g !== SELF && fs.existsSync(path.join(g, "story", "registry.js"))) : []);

const COUNTDOWN = /([0-9一二三四五六七八九十百两]+\s*(天|日|夜)(后|之后|倒计时)?)|倒计时|最后(一|1|[0-9]+)\s*(天|日|夜)|还(剩|有)\s*[0-9一二三四五六七八九十两]+\s*(天|日)/;

function load(dir) {
  const R = new Function("module", fs.readFileSync(path.join(dir, "story", "registry.js"), "utf8") + "\n;return module.exports;")({ exports: {} });
  const CH = {};
  for (const f of fs.readdirSync(path.join(dir, "story")).filter(f => /^ch\w*\.js$/.test(f)))
    vm.runInNewContext(fs.readFileSync(path.join(dir, "story", f), "utf8"), { STORY: { chapter: c => (CH[c.id] = c) } });
  return { R, CH, name: (R.TITLE && R.TITLE.name) || path.basename(path.resolve(dir, "..", "..")) };
}
const arr = v => (v == null ? [] : Array.isArray(v) ? v : [v]);

function fingerprint(dir) {
  const { R, CH, name } = load(dir), N = {};
  for (const c of Object.values(CH)) for (const [id, n] of Object.entries(c.nodes)) N[id] = n;
  const flow = (R.FLOW || []).flatMap(x => (typeof x === "string" ? [x] : x.pick || []));
  const jumped = new Set(Object.values(N).filter(n => n.end && n.end.type === "chapter" && n.end.id).map(n => n.end.id));
  const routes = [...jumped].filter(id => !flow.includes(id) && CH[id]);
  const routeBranch = Object.entries(N).filter(([, n]) => n.branch && n.branch.filter(b => N[b.next] && N[b.next].end && N[b.next].end.type === "chapter").length >= 2);
  const routeFlags = new Set(routeBranch.flatMap(([, n]) => n.branch.flatMap(b => arr(b.need)).filter(k => /^[fg]_/.test(k))));
  const timed = Object.values(N).filter(n => n.timer);
  const timedPick = timed.some(n => (n.choices || []).some(c => arr(c.set).some(k => routeFlags.has(k))));
  const shape = Object.values(N).some(n => n.end && (n.end.type === "retry" || (n.end.type === "loop" && n.end.retry))) && Object.keys(R.CLUES || {}).length ? "循环"
    : (R.FLOW || []).some(x => typeof x === "object") ? "自选"
    : routes.length >= 2 ? (routeBranch.length > 1 ? "梯子" : "分院帽")
    : Object.keys(R.CLUES || {}).length ? "线索" : "单线";
  const scenes = Object.keys(R.SCENES || {}), titles = [R.TITLE && R.TITLE.sub, ...Object.values(R.CHAPTERS || {}).map(c => c.title)].filter(Boolean);
  return {
    name, dir,
    形状: shape,
    重点角色: Object.keys(R.VARS || {}).length,
    分线: routes.length,
    结局: Object.keys(R.ENDINGS || {}).length,
    限时: timed.length,
    定线限时: timedPick ? "是" : "否",
    场景: scenes.filter(s => !/^cg_/.test(s) && !["black", "white", "cover"].includes(s)).length,
    CG: scenes.filter(s => /^cg_/.test(s)).length,
    数天: titles.filter(t => COUNTDOWN.test(t)).join(" / ") || "否",
    曲目: (R.BGM || []).filter(b => b !== "none"),
  };
}

const self = fingerprint(SELF), olds = others.map(d => { try { return fingerprint(d); } catch (e) { return null; } }).filter(Boolean);
const KEYS = ["形状", "重点角色", "分线", "结局", "限时", "定线限时", "场景", "CG", "数天"];
const pad = (s, n) => { s = String(s); const w = [...s].reduce((a, ch) => a + (ch.charCodeAt(0) > 255 ? 2 : 1), 0); return s + " ".repeat(Math.max(1, n - w)); };
console.log(pad("", 18) + KEYS.map(k => pad(k, 10)).join(""));
for (const f of [self, ...olds]) console.log(pad((f === self ? "* " : "  ") + f.name, 18) + KEYS.map(k => pad(f[k], 10)).join(""));

let warn = 0;
const W = m => { warn++; console.log("! " + m); };
if (self.数天 !== "否") W(`标题或章名在数天：${self.数天}（defaults-check「钩子和设定」）`);
for (const o of olds) {
  const same = KEYS.filter(k => k !== "数天" && String(self[k]) === String(o[k]));
  const SIG = ["形状", "重点角色", "分线", "结局"], sig = SIG.every(k => String(self[k]) === String(o[k]));
  const tracks = self.曲目.filter(t => o.曲目.includes(t)), jac = tracks.length / new Set([...self.曲目, ...o.曲目]).size;
  if (sig) W(`结构和《${o.name}》一样：${SIG.map(k => `${k} ${self[k]}`).join("、")}${self.定线限时 === o.定线限时 ? "，定线限时也一样" : ""}；换一种形状、人数或结局的形状（genres.md）`);
  else if (same.length >= 6) W(`和《${o.name}》有 ${same.length} 项结构指纹相同：${same.join("、")}`);
  if (jac >= 0.5 || tracks.length >= 4) W(`曲目表和《${o.name}》重合 ${Math.round(jac * 100)}%：${tracks.join(" ")}（曲目按本作的情绪地图写，character-writing §4）`);
}
if (!olds.length) console.log("· 没找到旧作（作品目录下没有别的 output/game），只打印本作");
console.log(warn ? `\n${warn} 条提醒；题材、人物、钩子这些轴在作品目录的 FINGERPRINTS.md 里比` : "\n结构上没和旧作撞；题材、人物、钩子这些轴在作品目录的 FINGERPRINTS.md 里比");
