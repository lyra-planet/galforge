#!/usr/bin/env node
/* 剧本校验：node tools/validate.js [story/ch2.js ...]，不带参数则校验 story/ch*.js 全部
 * 游戏目录 = $GAME_DIR，没设就是本脚本的上一级（脚本放在 <游戏>/tools/ 下）
 * 题材相关的检查读 registry 的 LINT：{ maxLine: 44, maxNarr: 34, banned: "正则", bannedWhy: "说明", dayStart: "05:00", firstChoice: 40 }
 * 跨章检查：章节关系 = FLOW 顺序 + 章末跳转（end: { type: "chapter", id }）；用到的线索要在本章或前面章节发过，还没写出来的章节跳过不查
 * flag：读了没人设 → 错误（f_ 每章清空，只认本章的 set；g_ 认本章和前面章节）；设了没人读 → 提醒（选择的后果没兑现）
 * 时间检查：同一章里时间不该倒退；早于 dayStart 的时间算第二天（跨午夜的夜戏不误报）
 * 新键取值对照 registry 的 TRANS AMB FX BGM（老 registry 没有 TRANS / AMB 时用默认表）
 * 文字标记 {w} {w=1.2} {slow}…{/slow} {slow=300} {big} {red} {shake} 查成对；量字数、查禁用词前先去掉
 * 节奏提醒：第一章开头到第一个选择点超过 LINT.firstChoice 句；限时选择没写 timeout、timer 不在 5–10 秒；
 *   好感判定后直接 end: retry；一章平均不到 15 行换一次 BGM；整章没有 bgm: "none"
 */
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = process.env.GAME_DIR || path.join(__dirname, "..");
const DIR = path.join(ROOT, "story");
const R = require(path.join(DIR, "registry.js"));
const LINT = Object.assign({ maxLine: 44, maxNarr: 34, banned: null, bannedWhy: "禁用词", dayStart: "05:00", firstChoice: 40 }, R.LINT);
const banned = LINT.banned ? new RegExp(LINT.banned) : null;
const chNo = f => +path.basename(f).match(/\d+/)[0];
const asArr = v => (v == null ? [] : Array.isArray(v) ? v : [v]);
const isFlag = s => /^[fg]_/.test(s);
const CMP = /^([A-Za-z_]\w*)\s*(>=|<=|==|!=|>|<)\s*([A-Za-z_]\w*|-?\d+)$/;
const VARS = R.VARS || {}, CLUES = R.CLUES || {}, EXPRS = R.EXPRS || [], EMOTES = R.EMOTES || [], TODS = R.TODS || null, POSES = R.POSES || null, ACTS = R.ACTS || null;
const TRANS = R.TRANS || ["cut", "dissolve", "black", "white", "wipe-l", "wipe-r", "wipe-u", "wipe-d", "iris", "blinds", "pixel", "eye-open", "eye-shut"];
const AMB = R.AMB || ["none", "rain", "cicada", "wind", "crowd", "night", "waves", "clock"];
const PORTRAITS = new Set(Object.values(R.SPEAKERS).map(s => s.portrait).filter(p => typeof p === "string"));
const POSITIONS = ["l", "c", "r", "ll", "rr"];
const LINE_KEYS = ["off", "emote", "pose", "act", "who", "jump", "sfx", "outfit", "weather", "props", "stage", "need", "needNot", "fx", "enter", "exit", "amb", "bgm"];
const TAG = /\{(\/?)(\w*)(?:=([^{}]*))?\}/g; // 文字标记
const plain = s => s.replace(TAG, "");
const bgmId = b => (b && typeof b === "object" ? b.id : b);
const lineOpt = l => (Array.isArray(l) && l[3] && typeof l[3] === "object" ? l[3] : null);
// 带条件的地方（选项、条件跳转、台词）和会 set flag 的地方（节点、选项、超时），带上位置给报错用
const condHolders = (id, n) => [...(n.choices || []).map((c, i) => [c, `${id}.choices[${i}]`]), ...(n.branch || []).map((b, i) => [b, `${id}.branch[${i}]`]),
  ...(n.lines || []).map((l, i) => [lineOpt(l), `${id}.lines[${i}]`]).filter(x => x[0])];
const setHolders = (id, n) => [[n, id], ...(n.choices || []).map((c, i) => [c, `${id}.choices[${i}]`]), ...(n.timeout && typeof n.timeout === "object" ? [[n.timeout, `${id}.timeout`]] : [])];

const chFiles = fs.readdirSync(DIR).filter(f => /^ch\w*\.js$/.test(f));
const files = process.argv.slice(2).length ? process.argv.slice(2).map(f => path.resolve(f))
  : chFiles.sort((a, b) => (chNo(a) || 0) - (chNo(b) || 0) || a.localeCompare(b)).map(f => path.join(DIR, f));

let errors = 0, warns = 0;
const err = m => { errors++; console.log(`  ✗ ${m}`); };
const warn = m => { warns++; console.log(`  ! ${m}`); };

// registry 里登记的表情 / 姿势 / 动作要和 pixel_art.js 真有的对上（画不出来的名字写进剧本，游戏里就静默变成默认）
{
  const artFile = path.join(ROOT, "pixel_art.js");
  if (fs.existsSync(artFile)) {
    const A = require(artFile);
    for (const [name, list, have] of [["表情", EXPRS, A.EXPR], ["姿势", POSES, A.POSES], ["动作", ACTS, A.ACTS]])
      if (list && have) for (const k of list) if (!(k in have)) err(`registry 登记了${name} ${k}，pixel_art.js 里没有`);
  }
}

// 全部已写出的章节（跨章检查用，和要校验哪些文件无关）
const ALL = {};
for (const f of chFiles) { try { vm.runInNewContext(fs.readFileSync(path.join(DIR, f), "utf8"), { STORY: { chapter: c => (ALL[c.id] = c) } }); } catch (e) {} }
const GRANT = {}; // 线索 → 发放它的章节
for (const [cid, c] of Object.entries(ALL)) for (const n of Object.values(c.nodes || {}))
  [n, ...(n.choices || [])].forEach(o => asArr(o.clue).forEach(k => (GRANT[k] = GRANT[k] || new Set()).add(cid)));
// flag 读写表：flag → 设它 / 读它的章节；registry.js、index.html 里直接写到的 flag 算引擎读写过
const FSET = {}, FREAD = {};
for (const [cid, c] of Object.entries(ALL)) for (const [id, n] of Object.entries(c.nodes || {})) {
  setHolders(id, n).forEach(([o]) => asArr(o.set).forEach(k => (FSET[k] = FSET[k] || new Set()).add(cid)));
  condHolders(id, n).forEach(([o]) => [...asArr(o.need), ...asArr(o.needNot)].filter(isFlag).forEach(k => (FREAD[k] = FREAD[k] || new Set()).add(cid)));
}
const OUTSIDE = ["story/registry.js", "index.html"].map(f => (fs.existsSync(path.join(ROOT, f)) ? fs.readFileSync(path.join(ROOT, f), "utf8") : "")).join("\n");
const outside = k => new RegExp(`\\b${k}\\b`).test(OUTSIDE);
const unwritten = Object.keys(R.CHAPTERS).some(c => !ALL[c]);
// 章节关系图：FLOW 顺序（自选组里互相算前面）+ 章末跳转
const FLOW = R.FLOW || Object.keys(R.CHAPTERS);
const FIRST = typeof FLOW[0] === "string" ? FLOW[0] : null; // 第一项是自选组时，第一个选择就是选章，不查开头长度
const EDGES = {}; const edge = (a, b) => (EDGES[a] = EDGES[a] || new Set()).add(b);
{ let prev = []; for (const st of FLOW) { const g = typeof st === "string" ? [st] : st.pick; for (const p of prev) for (const x of g) edge(p, x); if (g.length > 1) for (const x of g) for (const y of g) if (x !== y) edge(x, y); prev = g; } }
for (const [cid, c] of Object.entries(ALL)) for (const n of Object.values(c.nodes || {})) if (n.end && n.end.type === "chapter" && n.end.id) edge(cid, n.end.id);
function before(chId) { // 能走到 chId 的所有章节
  const out = new Set(), st = [chId];
  while (st.length) { const x = st.pop(); for (const [a, bs] of Object.entries(EDGES)) if (bs.has(x) && !out.has(a)) { out.add(a); st.push(a); } }
  out.delete(chId); return [...out];
}
const toMin = t => { const [h, m] = t.split(":").map(Number), [dh, dm] = LINT.dayStart.split(":").map(Number), v = h * 60 + m; return v < dh * 60 + dm ? v + 1440 : v; };

function checkCond(k, where) {
  if (isFlag(k)) return; // flag 的读写配对在每章末尾统一查
  const m = CMP.exec(k);
  if (m) { for (const x of [m[1], m[3]]) if (!/^-?\d+$/.test(x) && !VARS[x]) err(`${where}: 条件 ${k} 用了未登记的数值 ${x}`); return; }
  if (/[<>=!]/.test(k)) return err(`${where}: 条件 ${k} 写法不对，应该像 "a>=3" 或 "a>b"`);
  if (!CLUES[k]) err(`${where}: need 用了未登记的线索 ${k}`);
}
function checkAdd(add, where) {
  if (add == null) return;
  if (typeof add !== "object") return err(`${where}: add 应写成 { 数值名: 加多少 }`);
  for (const [k, v] of Object.entries(add)) { if (!VARS[k]) err(`${where}: add 用了未登记的数值 ${k}`); if (typeof v !== "number") err(`${where}: add.${k} 应是数字`); }
}
function checkSpec(sp, where) {
  const m = /^([^:@#]+)(?::([^@#]+))?(?:@([^#]+))?(?:#(.+))?$/.exec(sp || "");
  if (!m) return err(`${where}: 站位写法应为 "角色id[:表情][@服装][#姿势]"`);
  if (m[4] && POSES && !POSES.includes(m[4])) err(`${where}: 未知姿势 ${m[4]}`);
  if (!PORTRAITS.has(m[1])) err(`${where}: ${m[1]} 不是任何说话人的 portrait`);
  if (m[2] && !EXPRS.includes(m[2])) err(`${where}: 未知表情 ${m[2]}`);
  if (m[3] && R.OUTFITS && !(R.OUTFITS[m[1]] || []).includes(m[3])) err(`${where}: ${m[1]} 没有服装 ${m[3]}`);
}
function checkBgm(b, at) { // "曲名" / "none" / { id, fade }
  if (b && typeof b === "object") {
    for (const k of Object.keys(b)) if (!["id", "fade"].includes(k)) err(`${at}: bgm 对象只认 id fade，多了 ${k}`);
    if (b.fade != null && !(typeof b.fade === "number" && b.fade >= 0)) err(`${at}: bgm.fade 应是秒数`);
  } else if (typeof b !== "string") return err(`${at}: bgm 应写成曲名、"none" 或 { id, fade }`);
  if (!R.BGM.includes(bgmId(b))) err(`${at}: 未知 bgm ${bgmId(b)}`);
}
function checkTrans(t, at) { // "dissolve" / { kind, ms }
  if (t && typeof t === "object") {
    for (const k of Object.keys(t)) if (!["kind", "ms"].includes(k)) err(`${at}: trans 对象只认 kind ms，多了 ${k}`);
    if (t.ms != null && !(typeof t.ms === "number" && t.ms >= 0)) err(`${at}: trans.ms 应是毫秒数`);
  }
  const kind = t && typeof t === "object" ? t.kind : t;
  if (!TRANS.includes(kind)) err(`${at}: 未知转场 ${kind}，可选 ${TRANS.join(" ")}`);
}
function checkMarks(text, at) { // 文字标记：认识、成对、不交叉
  const stack = [];
  const rest = text.replace(TAG, (all, close, tag, arg) => {
    if (!["w", "slow", "big", "red", "shake"].includes(tag)) { err(`${at}: 未知标记 ${all}，只认 {w} {slow} {big} {red} {shake}`); return ""; }
    if (tag === "w") { if (close) err(`${at}: {w} 是单个的停顿，没有 {/w}`); else if (arg != null && !(+arg > 0)) err(`${at}: ${all} 的停顿秒数应是正数`); return ""; }
    if (close) {
      if (stack[stack.length - 1] === tag) stack.pop();
      else if (stack.includes(tag)) { err(`${at}: 标记交叉，${all} 之前要先关 {/${stack[stack.length - 1]}}`); stack.splice(stack.lastIndexOf(tag), 1); }
      else err(`${at}: ${all} 前面没有 {${tag}}`);
    } else {
      if (arg != null && !(tag === "slow" && +arg > 0)) err(`${at}: ${all} 写法不对${tag === "slow" ? "，{slow=毫秒}" : `，{${tag}} 不带参数`}`);
      if (stack.includes(tag)) err(`${at}: {${tag}} 套在了另一个 {${tag}} 里`);
      stack.push(tag);
    }
    return "";
  });
  if (stack.length) err(`${at}: {${stack.join("} {")}} 没有关上`);
  if (/[{}]/.test(rest)) err(`${at}: 有落单的花括号，标记写法是 {w} {slow}…{/slow} 这种`);
}

for (const file of files) {
  console.log(path.basename(file));
  const chapters = [];
  try { vm.runInNewContext(fs.readFileSync(file, "utf8"), { STORY: { chapter: c => chapters.push(c) } }, { filename: file }); }
  catch (e) { err("无法执行：" + e.message); continue; }
  if (chapters.length !== 1) { err(`应调用 STORY.chapter 一次，实际 ${chapters.length} 次`); continue; }
  const ch = chapters[0], N = ch.nodes || {};
  if (!R.CHAPTERS[ch.id]) err(`未知章节 id ${ch.id}`);
  const pre = "c" + String(ch.id).replace(/^ch/, "") + "_";
  if (!N[ch.start]) err(`start 节点 ${ch.start} 不存在`);
  let lineCount = 0, choicePoints = 0, timers = 0, ends = 0;
  const refs = (id, from) => { if (!N[id]) err(`${from} 指向不存在的节点 ${id}`); };
  for (const [id, n] of Object.entries(N)) {
    if (!id.startsWith(pre)) err(`节点 ${id} 没有前缀 ${pre}`);
    if (!R.SCENES[n.scene]) err(`${id}: 未知场景 ${n.scene}`);
    if (!n.shot) warn(`${id}: 缺少 shot`);
    if (n.time && !/^\d\d:\d\d$/.test(n.time)) err(`${id}: time 格式应为 HH:MM`);
    if (n.day != null && !(Number.isInteger(n.day) && n.day > 0)) err(`${id}: day 应为正整数（第几天）`);
    if (n.tod && TODS && !TODS.includes(n.tod)) err(`${id}: 未知时段 tod ${n.tod}`);
    if (n.weather && !(R.WEATHERS || ["clear", "rain"]).includes(n.weather)) err(`${id}: 未知天气 weather ${n.weather}`);
    const checkProps = (pr, at) => { if (typeof pr !== "object") return err(`${at}: props 应写成 { 名字: 1 / 0 }`); for (const k of Object.keys(pr)) if (!(R.PROPS || {})[k]) err(`${at}: props 用了未登记的开关 ${k}`); };
    if (n.props) checkProps(n.props, id);
    if (n.bgm != null) checkBgm(n.bgm, id);
    if (n.bgmVol != null && !(typeof n.bgmVol === "number" && n.bgmVol >= 0 && n.bgmVol <= 1)) err(`${id}: bgmVol 应是 0–1 的数`);
    if (n.amb != null && !AMB.includes(n.amb)) err(`${id}: 未知环境音 amb ${n.amb}，可选 ${AMB.join(" ")}`);
    if (n.trans != null) checkTrans(n.trans, id);
    if (n.sfx && !R.SFX.includes(n.sfx)) err(`${id}: 未知 sfx ${n.sfx}`);
    if (n.fx && !R.FX.includes(n.fx)) err(`${id}: 未知 fx ${n.fx}`);
    if (n.stage) { if (typeof n.stage !== "object") err(`${id}: stage 应写成 { l: "角色", r: "角色:表情" }`); else for (const [pos, sp] of Object.entries(n.stage)) { if (!POSITIONS.includes(pos)) err(`${id}: stage 位置 ${pos} 只能是 ${POSITIONS.join(" ")}`); checkSpec(sp, `${id}.stage.${pos}`); } }
    asArr(n.clue).forEach(k => { if (!CLUES[k]) err(`${id}: 未登记线索 ${k}`); });
    asArr(n.set).forEach(k => { if (!isFlag(k)) err(`${id}: flag ${k} 应以 f_ 或 g_ 开头`); });
    checkAdd(n.add, id);
    for (const [i, l] of (n.lines || []).entries()) {
      lineCount++;
      const at = `${id}.lines[${i}]`;
      if (!Array.isArray(l) || typeof l[1] !== "string") { err(`${at} 格式应为 [说话人, 文本, 表情?, 选项?]`); continue; }
      if (!(l[0] in R.SPEAKERS)) err(`${at}: 未知说话人 ${l[0]}`);
      if (l[2] && !EXPRS.includes(l[2])) err(`${at}: 未知表情 ${l[2]}`);
      const o = l[3];
      if (o != null && o !== "off") {
        if (typeof o === "string") { if (!EMOTES.includes(o)) err(`${at}: 第 4 项 ${o} 既不是 "off" 也不是登记过的表情符号`); }
        else if (typeof o === "object") {
          for (const k of Object.keys(o)) if (!LINE_KEYS.includes(k)) err(`${at}: 未知选项 ${k}`);
          if (o.who && !PORTRAITS.has(o.who)) err(`${at}: who = ${o.who} 不是任何说话人的 portrait`);
          if ((o.pose || o.act) && !o.who && !(R.SPEAKERS[l[0]] || {}).portrait) err(`${at}: 旁白 / 主角的台词写了 pose / act，要加 who 说明是谁在动`);
          if (o.pose && POSES && !POSES.includes(o.pose)) err(`${at}: 未知姿势 ${o.pose}`);
          if (o.act && ACTS && !ACTS.includes(o.act)) err(`${at}: 未知动作 ${o.act}`);
          if (o.stage) { if (typeof o.stage !== "object") err(`${at}: stage 应写成 { l: "角色" }`); else for (const [pos, sp] of Object.entries(o.stage)) { if (!POSITIONS.includes(pos)) err(`${at}: stage 位置 ${pos} 只能是 ${POSITIONS.join(" ")}`); checkSpec(sp, `${at}.stage.${pos}`); } }
          for (const k of ["enter", "exit"]) if (o[k] != null) {
            if (!["left", "right"].includes(o[k])) err(`${at}: ${k} 只能是 "left" / "right"`);
            if (!o.stage) err(`${at}: ${k} 要和 stage 写在一起（谁上场 / 离场看 stage 的变化）`);
          }
          if (o.weather && !(R.WEATHERS || ["clear", "rain"]).includes(o.weather)) err(`${at}: 未知天气 ${o.weather}`);
          if (o.props) checkProps(o.props, at);
          if (o.emote && !EMOTES.includes(o.emote)) err(`${at}: 未知表情符号 ${o.emote}`);
          if (o.sfx && !R.SFX.includes(o.sfx)) err(`${at}: 未知 sfx ${o.sfx}`);
          if (o.fx && !R.FX.includes(o.fx)) err(`${at}: 未知 fx ${o.fx}`);
          if (o.amb != null && !AMB.includes(o.amb)) err(`${at}: 未知环境音 amb ${o.amb}`);
          if (o.bgm != null) checkBgm(o.bgm, at);
          asArr(o.need).forEach(k => checkCond(k, at)); asArr(o.needNot).forEach(k => checkCond(k, at));
          const pid = (R.SPEAKERS[l[0]] || {}).portrait;
          if (o.outfit && R.OUTFITS && !(R.OUTFITS[pid] || []).includes(o.outfit)) err(`${at}: ${pid} 没有服装 ${o.outfit}`);
        } else err(`${at}: 第 4 项应是 "off"、表情符号名或对象`);
      }
      checkMarks(l[1], at);
      const text = plain(l[1]), max = l[0] === "" ? LINT.maxNarr : LINT.maxLine;
      if ([...text].length > max) warn(`${at} 超过 ${max} 字：${text.slice(0, 20)}…`);
      if (banned && banned.test(text)) warn(`${at} ${LINT.bannedWhy}：${text}`);
    }
    const kinds = ["next", "choices", "branch", "end"].filter(k => n[k] != null);
    if (kinds.length !== 1) err(`${id}: next/choices/branch/end 必须且只能有一个，实际 [${kinds}]`);
    if (n.next) refs(n.next, id);
    if (n.choices) {
      choicePoints++; if (n.timer) timers++;
      if (!n.choices.length) err(`${id}: choices 为空`);
      n.choices.forEach((c, i) => {
        const at = `${id}.choices[${i}]`;
        if (!c.t) err(`${at} 缺少 t`);
        refs(c.next, at);
        asArr(c.clue).forEach(k => { if (!CLUES[k]) err(`${at} 未登记线索 ${k}`); });
        asArr(c.set).forEach(k => { if (!isFlag(k)) err(`${at} flag ${k} 应以 f_ 或 g_ 开头`); });
        checkAdd(c.add, at);
        asArr(c.need).forEach(k => checkCond(k, at)); asArr(c.needNot).forEach(k => checkCond(k, at));
      });
      if (n.choices.every(c => c.need && c.need.length)) warn(`${id}: 所有选项都有 need，可能出现没有选项可选（真走得到的死路看 solve.js --endings 的「死路」那行）`);
    }
    // 限时选择：超时走 timeout（沉默 / 犹豫的后果），不写才退回第一项
    if (n.timer != null) {
      if (!n.choices) err(`${id}: timer 只能写在有 choices 的节点`);
      else if (!(typeof n.timer === "number" && n.timer > 0)) err(`${id}: timer 应是秒数`);
      else {
        if (n.timer < 5 || n.timer > 10) warn(`${id}: timer ${n.timer} 秒，建议 5–10 秒`);
        if (!n.timeout) warn(`${id}: 限时选择没写 timeout，超时会退回第一项；写 timeout: { next, add, set }，内容是沉默 / 犹豫的后果`);
      }
    }
    if (n.timeout != null) {
      const t = n.timeout, at = `${id}.timeout`;
      if (typeof t !== "object") err(`${at} 应写成 { next, add, set }`);
      else {
        if (!n.timer) err(`${id}: 写了 timeout 但没有 timer，超时永远不会发生`);
        for (const k of Object.keys(t)) if (!["next", "add", "set"].includes(k)) err(`${at} 只认 next add set，多了 ${k}`);
        refs(t.next, at);
        asArr(t.set).forEach(k => { if (!isFlag(k)) err(`${at} flag ${k} 应以 f_ 或 g_ 开头`); });
        checkAdd(t.add, at);
      }
    }
    if (n.branch) {
      n.branch.forEach((b, i) => { refs(b.next, `${id}.branch[${i}]`); asArr(b.need).forEach(k => checkCond(k, `${id}.branch[${i}]`)); asArr(b.needNot).forEach(k => checkCond(k, `${id}.branch[${i}]`)); });
      if (n.branch[n.branch.length - 1].need) err(`${id}: branch 最后一项应是无条件的兜底`);
    }
    if (n.end) {
      ends++;
      const t = n.end.type;
      if (!["chapter", "retry", "ending", "loop"].includes(t)) err(`${id}: end.type 只能是 chapter / retry / ending / loop`);
      if (t === "ending" && !R.ENDINGS[n.end.id]) err(`${id}: 未知结局 ${n.end.id}`);
      if (t === "chapter" && n.end.id && !R.CHAPTERS[n.end.id]) err(`${id}: 跳转到未登记的章节 ${n.end.id}`);
    }
  }
  // 可达性（超时也是一条出路）
  const succ = n => [n.next, ...(n.choices || []).map(c => c.next), ...(n.branch || []).map(b => b.next), n.timeout && n.timeout.next].filter(x => x && N[x]);
  const seen = new Set(), stack = [ch.start];
  while (stack.length) { const id = stack.pop(); if (seen.has(id) || !N[id]) continue; seen.add(id); stack.push(...succ(N[id])); }
  for (const id of Object.keys(N)) if (!seen.has(id)) warn(`${id} 从 start 无法到达`);
  if (!ends) err("没有任何 end 节点");
  // 死循环：从每个节点出发都应能到达某个 end（不动点迭代；带 visited 的 DFS 遇到环会误报）
  const canEnd = new Set(Object.keys(N).filter(id => N[id].end));
  for (let changed = true; changed;) { changed = false; for (const id of Object.keys(N)) if (!canEnd.has(id) && succ(N[id]).some(x => canEnd.has(x))) { canEnd.add(id); changed = true; } }
  for (const id of seen) if (!canEnd.has(id)) err(`${id} 之后永远到不了 end`);
  // 本章里 match 的效果（线索、flag）生效之后能走到的节点：节点自己的效果进节点就生效，选项 / 超时的效果从它的 next 起
  const reachAfter = match => {
    const st = [];
    for (const [g, x] of Object.entries(N)) {
      if (match(x)) st.push(g);
      for (const c of x.choices || []) if (match(c)) st.push(c.next);
      if (x.timeout && typeof x.timeout === "object" && match(x.timeout)) st.push(x.timeout.next);
    }
    const reach = new Set();
    while (st.length) { const y = st.pop(); if (reach.has(y) || !N[y]) continue; reach.add(y); st.push(...succ(N[y])); }
    return reach;
  };
  // 跨章：need 里的线索要在本章或前面章节发过；发放章还没写出来就跳过
  const prior = new Set(before(ch.id));
  for (const [id, n] of Object.entries(N)) for (const [o] of condHolders(id, n)) for (const k of asArr(o.need)) {
    if (isFlag(k) || CMP.test(k) || !CLUES[k]) continue;
    const src = GRANT[k] ? [...GRANT[k]] : [];
    if (src.some(c => c !== ch.id && prior.has(c))) continue;
    if (src.includes(ch.id)) { // 只在本章发：至少要有一个发放点能走到这里，否则这个选项永远出不来
      const from = Object.keys(N).filter(g => [N[g], ...(N[g].choices || [])].some(x => asArr(x.clue).includes(k)));
      if (!reachAfter(x => asArr(x.clue).includes(k)).has(id)) err(`${id} 用到线索 ${k}，但本章发放它的 ${from.join(" ")} 都在这之后，这个选项永远出不来`);
      continue;
    }
    const home = "ch" + CLUES[k].ch;
    if (!src.length && !ALL[home]) continue; // 应该发它的章节还没写
    err(`${id} 用到线索 ${k}，但${src.length ? `它只在之后的 ${src.join(" ")} 发放` : "没有任何节点发放它"}`);
  }
  for (const [id, n] of Object.entries(N)) [n, ...(n.choices || [])].forEach(o => asArr(o.clue).forEach(k => {
    if (CLUES[k] && "ch" + CLUES[k].ch !== ch.id && !prior.has("ch" + CLUES[k].ch)) warn(`${id} 发放线索 ${k}，但 registry 写它首次出现在 ch${CLUES[k].ch}`);
  }));
  // flag 读了没人设 → 错误（拼错的 flag 会让选项永远不出现）；f_ 换章清空，只认本章；g_ 认本章和前面章节
  const fReach = {};
  for (const [id, n] of Object.entries(N)) for (const [o, at] of condHolders(id, n))
    for (const [k, not] of [...asArr(o.need).map(k => [k, 0]), ...asArr(o.needNot).map(k => [k, 1])]) {
      if (!isFlag(k) || outside(k)) continue;
      const src = FSET[k] ? [...FSET[k]] : [];
      if (k.startsWith("f_")) {
        if (!src.includes(ch.id)) { err(`${at}: 读了 ${k}，本章没有任何地方 set 它${src.length ? `（它在 ${src.join(" ")} 设；f_ 换章就清空，跨章用 g_）` : "（拼错了？）"}`); continue; }
        if (!(fReach[k] = fReach[k] || reachAfter(x => asArr(x.set).includes(k))).has(id)) err(`${at}: 读 ${k}，但本章设它的地方都走不到这里，这个条件永远${not ? "成立" : "不成立"}`);
      } else if (!src.some(c => c === ch.id || prior.has(c))) {
        if (src.length) err(`${at}: 读了 ${k}，它只在之后的 ${src.join(" ")} 设`);
        else if (unwritten) warn(`${at}: 读了 ${k}，已写的章节里没有地方 set 它（还有章节没写，写完再查）`);
        else err(`${at}: 读了 ${k}，没有任何地方 set 它（拼错了？）`);
      }
    }
  // flag 设了没人读 → 提醒：这个选择的后果没有兑现
  const warned = new Set();
  for (const [id, n] of Object.entries(N)) for (const [o, at] of setHolders(id, n)) for (const k of asArr(o.set)) {
    if (!isFlag(k) || warned.has(k) || outside(k)) continue;
    const rd = FREAD[k] ? [...FREAD[k]] : [], f = k.startsWith("f_");
    if (f ? !rd.includes(ch.id) : !rd.length) { warned.add(k); warn(`${at}: 设了 ${k}，${f ? "本章" : "所有章节"}没有条件读它，这个选择的后果没有兑现${!f && unwritten ? "（还有章节没写）" : ""}`); }
  }
  // 好感比较的判定后面直接 retry：好感不够要有出口
  const toRetry = id => { for (let k = 0, x = id; k < 50 && N[x]; k++, x = N[x].next) { const m = N[x]; if (m.end) return m.end.type === "retry" || (m.end.type === "loop" && m.end.retry) ? x : null; if (m.choices || m.branch) return null; } return null; };
  const byAff = b => [...asArr(b.need), ...asArr(b.needNot)].some(k => { const m = CMP.exec(k); return m && (VARS[m[1]] || VARS[m[3]]); });
  for (const [id, n] of Object.entries(N)) if (n.branch && n.branch.some(byAff)) n.branch.forEach((b, i) => {
    const r = toRetry(b.next);
    if (r) warn(`${id}.branch[${i}] 按数值判定后直接 end: retry（${r}）：数值不够要有出口，进别的结局或带着低好感进下一章；retry 只留给剧情里的明确失败`);
  });
  // 同一个节点的几个选项汇到同一处，那里的条件台词却按好感值分：前面别的选项也加分，数值分不出刚才选了哪项，要按选项 set 的 f_ 分
  for (const [id, n] of Object.entries(N)) {
    const cnt = {}; for (const c of n.choices || []) cnt[c.next] = (cnt[c.next] || 0) + 1;
    for (const [t, k] of Object.entries(cnt)) if (k >= 2 && N[t]) (N[t].lines || []).forEach((l, i) => {
      const o = lineOpt(l); if (o && byAff(o)) warn(`${t}.lines[${i}] 按数值分台词，可它是 ${id} 的 ${k} 个选项的汇合处：数值分不出刚才选了哪项，回应选项要按选项 set 的 f_ 分`);
    });
  }
  // 时间：沿着边传递「当前第几天 + 时间」，显式写的 day / time 早于上一个节点就提醒；换天（day 变大）时间从头算
  const key = (v, prev) => { const n = N[v], d = n.day != null ? n.day : Math.floor(prev / 10000), t = n.time ? toMin(n.time) : d !== Math.floor(prev / 10000) ? 0 : prev % 10000; return d * 10000 + t; };
  const st = N[ch.start], eff = {}; if (st) eff[ch.start] = (st.day || 0) * 10000 + (st.time ? toMin(st.time) : 0);
  const backs = new Set();
  for (let pass = 0, changed = true; changed && pass < 50; pass++) {
    changed = false;
    for (const [id, n] of Object.entries(N)) {
      if (eff[id] == null) continue;
      for (const v of succ(n)) {
        const nv = key(v, eff[id]);
        if ((N[v].time || N[v].day != null) && nv < eff[id]) backs.add(`${id} → ${v}`);
        if (eff[v] == null || nv > eff[v]) { eff[v] = nv; changed = true; }
      }
    }
  }
  // 钩子：标题副标题、章名、标题卡里数天 / 倒计时（defaults-check「钩子和设定」）
  { const CD = /([0-9一二三四五六七八九十百两]+\s*(天|日|夜)(后|之后|倒计时)?)|倒计时|最后(一|1|[0-9]+)\s*(天|日|夜)|还(剩|有)\s*[0-9一二三四五六七八九十两]+\s*(天|日)/;
    const t = [ch.title, ...Object.values(N).filter(n => n.title).flatMap(n => asArr(n.title))].filter(x => typeof x === "string" && CD.test(x));
    if (t.length) warn(`章名、标题卡在数天：${[...new Set(t)].join(" / ")}；倒计时当钩子是最顺手的套路，换成本作人物和地方里的东西（references/defaults-check.md）`); }
  for (const b of backs) { const v = N[b.split(" → ")[1]]; warn(`时间倒退：${b}（${[v.day != null && "第 " + v.day + " 天", v.time].filter(Boolean).join(" ")} 早于前一个节点）`); }
  // BGM：沿着边传「可能正在放的曲子」，写的 bgm 和进来时可能在放的不一样才算换曲（"none" 是静音，不算换曲）
  const bgmWalk = (n, cur, onSet) => { for (const b of [n.bgm, ...(n.lines || []).map(l => (lineOpt(l) || {}).bgm)]) if (b != null) { onSet && onSet(cur, bgmId(b)); cur = new Set([bgmId(b)]); } return cur; };
  const playing = { [ch.start]: new Set(["?"]) }; // 章首接着上一章的曲子
  for (let pass = 0, changed = true; changed && pass < 100; pass++) {
    changed = false;
    for (const [id, n] of Object.entries(N)) if (playing[id]) {
      const out = bgmWalk(n, playing[id]);
      for (const v of succ(n)) { const s = (playing[v] = playing[v] || new Set()); for (const x of out) if (!s.has(x)) { s.add(x); changed = true; } }
    }
  }
  let bgmChanges = 0, silent = false;
  // 不算换曲的：章首第一次放（接着上一章的「?」）、结局节点（结局放结局曲是常规）
  for (const [id, n] of Object.entries(N)) { const isEnd = n.end && n.end.type && n.end.type !== "chapter"; bgmWalk(n, playing[id] || new Set(["?"]), (cur, b) => { if (b === "none") silent = true; else if (!(cur.size === 1 && cur.has(b)) && !(cur.size === 1 && cur.has("?")) && !isEnd) bgmChanges++; }); }
  if (bgmChanges && lineCount / bgmChanges < 15) warn(`本章 ${lineCount} 句换了 ${bgmChanges} 次 BGM，平均 ${(lineCount / bgmChanges).toFixed(1)} 句一次：一首至少撑 20–30 句，情绪转折才换`);
  if (!silent && lineCount) warn(`本章没有 bgm: "none"：每章留一段静音（真相揭开前、关键一句前、坏消息之后），静音时配环境音`);
  // 第一章开头到第一个选择点：最短要读几句（节点权重 = 台词数）
  if (ch.id === FIRST && N[ch.start]) {
    const cost = n => (n.lines || []).length, chars = n => (n.lines || []).reduce((a, l) => a + (Array.isArray(l) && typeof l[1] === "string" ? [...plain(l[1])].length : 0), 0);
    const done = new Set(), todo = [[cost(N[ch.start]), chars(N[ch.start]), ch.start]];
    let hit = null;
    while (todo.length && !hit) {
      todo.sort((a, b) => a[0] - b[0]); const [d, c, id] = todo.shift();
      if (done.has(id)) continue; done.add(id);
      if (N[id].choices) hit = [d, c, id];
      else for (const v of succ(N[id])) if (!done.has(v)) todo.push([d + cost(N[v]), c + chars(N[v]), v]);
    }
    if (hit) {
      console.log(`  开头到第一个选择点（${hit[2]}）${hit[0]} 句 · ${hit[1]} 字`);
      if (hit[0] > LINT.firstChoice) warn(`第一章开头到第一个选择点 ${hit[0]} 句，超过 ${LINT.firstChoice}：第一个选项不晚于 40 句左右，开头 100 次点击内要出钩子`);
    } else if (lineCount > LINT.firstChoice) warn(`第一章 ${lineCount} 句里没有选择点`);
  }
  console.log(`  节点 ${Object.keys(N).length} · 台词 ${lineCount} · 选择点 ${choicePoints} · 限时 ${timers} · 结尾 ${ends} · 换曲 ${bgmChanges}`);
}
// 全量校验时的整体检查：登记了却走不到的章节、从没被加过的好感
if (!process.argv.slice(2).length) {
  console.log("全局");
  if (R.METERS != null) {
    if (!Array.isArray(R.METERS)) err("R.METERS 应是数组：[{ var, label, scale, unit, digits, warn, need }]");
    else R.METERS.forEach((m, i) => {
      if (!m || !VARS[m.var]) err(`R.METERS[${i}].var ${m && m.var} 不在 R.VARS 里`);
      const bad = Object.keys(m || {}).filter(k => !["var", "label", "scale", "unit", "digits", "warn", "need"].includes(k));
      if (bad.length) err(`R.METERS[${i}] 不认识的键 ${bad.join(" ")}`);
    });
  }
  const first = typeof FLOW[0] === "string" ? FLOW[0] : FLOW[0].pick[0], reach = new Set([first]), st = [first];
  while (st.length) { const x = st.pop(); for (const y of EDGES[x] || []) if (!reach.has(y)) { reach.add(y); st.push(y); } }
  for (const id of Object.keys(R.CHAPTERS)) if (!reach.has(id)) warn(`章节 ${id} 既不在 FLOW 里，也没有任何章末跳转到它`);
  const added = new Set();
  for (const c of Object.values(ALL)) for (const n of Object.values(c.nodes || {})) [n, ...(n.choices || []), ...(n.timeout && typeof n.timeout === "object" ? [n.timeout] : [])].forEach(o => Object.keys(o.add || {}).forEach(k => added.add(k)));
  for (const k of Object.keys(VARS)) if (!added.has(k)) warn(`数值 ${k} 登记了，但没有任何节点或选项加减它`);
  const CD = /([0-9一二三四五六七八九十百两]+\s*(天|日|夜)(后|之后|倒计时)?)|倒计时|最后(一|1|[0-9]+)\s*(天|日|夜)|还(剩|有)\s*[0-9一二三四五六七八九十两]+\s*(天|日)/;
  const tt = [R.TITLE && R.TITLE.sub, R.TITLE && R.TITLE.name, ...Object.values(R.CHAPTERS || {}).map(c => c.title)].filter(x => typeof x === "string" && CD.test(x));
  if (tt.length) warn(`标题、副标题、章名在数天：${tt.join(" / ")}；倒计时当钩子是最顺手的套路，换成本作人物和地方里的东西（references/defaults-check.md）`);
}
console.log(`\n${errors} 个错误，${warns} 个提醒`);
process.exit(errors ? 1 : 0);
