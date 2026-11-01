#!/usr/bin/env node
/* 结局求解：从第一章开始整局广度优先搜索，跨章带着好感（VARS）、线索、g_ flag 一起走。
 *   node tools/solve.js --endings          每个结局：能不能走到、最短的选择路径、到达时各好感的值；走不到的说卡在哪
 *   node tools/solve.js <节点id>            到达某个节点的最短路径
 *   node tools/solve.js --vars <节点id>     到达某个节点时，各好感的取值范围（定门槛用）
 *   node tools/solve.js --odds <判定节点>   本章入线好感最低 / 最高各一档：可见选项等概率随机走，到判定点进各分支的概率；
 *                                          全选最优能否进第一个分支。随机不算超时，全选最优算
 *   node tools/solve.js --merge [章节id]    入度 ≥ 2 的节点：各条来路到达时 flag / 线索的差异、在场的人、好感范围（审读汇合点用）
 *   node tools/solve.js --routes            每个结局最短选法的完整标签（选项原文、「（超时）」、「【章节】」），JSON，给 playtest.js 在引擎里实跑
 *   node tools/solve.js --walk [局数=20000]  在剧本模型上随机走：各结局的随机到达率，和走到每个结局的一条路径（状态太多、--endings 被截断时用它证明能走到）
 * 章节顺序按 registry 的 FLOW，章末 end: { type: "chapter", id } 跳到指定章；retry 当死路；f_ flag 每章清空。
 * 限时选择写了 timeout：超时算一条额外的路（路径里记「（超时）」）；台词级 need 只管这行显不显示，不影响流程。
 * 状态太多时（超过 MAX，默认 30 万）会截断并提醒。游戏目录 = $GAME_DIR，没设就是本脚本的上一级
 */
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = process.env.GAME_DIR || path.join(__dirname, "..");
const R = require(path.join(ROOT, "story", "registry.js"));
const MAX = +(process.env.MAX || 300000);
const args = process.argv.slice(2), MERGE = args[0] === "--merge";
const arr = v => (v == null ? [] : Array.isArray(v) ? v : [v]);
const CH = {};
for (const f of fs.readdirSync(path.join(ROOT, "story")).filter(f => /^ch\w*\.js$/.test(f)))
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "story", f), "utf8"), { STORY: { chapter: c => (CH[c.id] = c) } });
const NODE = {}; for (const [cid, c] of Object.entries(CH)) for (const [id, n] of Object.entries(c.nodes)) NODE[id] = Object.assign({ _ch: cid }, n);
const FLOW = R.FLOW || Object.keys(R.CHAPTERS), VARS = Object.keys(R.VARS || {});
const CMP = /^([A-Za-z_]\w*)\s*(>=|<=|==|!=|>|<)\s*([A-Za-z_]\w*|-?\d+)$/;
const timeoutOf = n => (n.choices && n.timer && n.timeout && n.timeout.next ? n.timeout : null);

function test(st, k) {
  const m = CMP.exec(k);
  if (m) { const v = x => (/^-?\d+$/.test(x) ? +x : st.vars[x] || 0), a = v(m[1]), b = v(m[3]); return { ">=": a >= b, "<=": a <= b, "==": a === b, "!=": a !== b, ">": a > b, "<": a < b }[m[2]]; }
  return st.keep.includes(k) || st.flags.includes(k);
}
const ok = (st, o) => arr(o.need).every(k => test(st, k)) && !arr(o.needNot).some(k => test(st, k));
function apply(st, o) { // 节点、选项或超时的效果：线索、flag、好感
  const s = { ...st, keep: [...st.keep], flags: [...st.flags], vars: { ...st.vars } };
  for (const k of arr(o.clue)) if (!s.keep.includes(k)) s.keep.push(k);
  for (const k of arr(o.set)) { const L = k.startsWith("g_") ? s.keep : s.flags; if (!L.includes(k)) L.push(k); }
  for (const [k, v] of Object.entries(o.add || {})) s.vars[k] = (s.vars[k] || 0) + v;
  return s;
}
const stepIn = (id, base) => apply({ ...base, node: id }, NODE[id]); // 进节点：节点自己的效果马上生效
const pickBranch = (n, s) => n.branch.find(b => ok(s, b)) || n.branch[n.branch.length - 1];
function nextChapters(done) { // 按 FLOW 接下来可以进哪些章
  for (const st of FLOW) {
    if (typeof st === "string") { if (!done.includes(st)) return [st]; }
    else { const left = st.pick.filter(x => !done.includes(x)); if (left.length) return left; }
  }
  return [];
}
// 只影响台词显不显示的 flag（只在台词的 need 里出现）不改变走向：去重时不算它们，状态数能少几个量级（--merge 要看台词级的差异，照旧全算）
const FLOWF = new Set();
for (const n of Object.values(NODE)) for (const o of [...(n.choices || []), ...(n.branch || [])]) for (const k of [...arr(o.need), ...arr(o.needNot)]) if (!CMP.test(k)) FLOWF.add(k);
const fk = L => (MERGE ? L : L.filter(k => FLOWF.has(k))).slice().sort().join(",");
const key = s => [s.node, fk(s.flags), fk(s.keep), VARS.map(k => s.vars[k] || 0).join(","), s.done.slice().sort().join(",")].join("|");

// 广度优先：每个状态 = 刚进入某个节点（效果已生效）
const parent = new Map(), arrive = {}, endings = {}, dead = {};
const inc = {}; // --merge：节点 → 来路 → 从这条来路到达时的状态（还没进节点）
const note = (to, from, via, s) => {
  if (!MERGE || !NODE[to] || NODE[to]._ch !== NODE[from]._ch) return;
  const rs = (inc[to] = inc[to] || {}), k = from + "\n" + via;
  (rs[k] = rs[k] || { from, via, states: [] }).states.push(s);
};
let truncated = false;
function enter(prev, nodeId, base, label) {
  const n = NODE[nodeId]; if (!n) return;
  const s = stepIn(nodeId, base), k = key(s);
  if (parent.has(k)) return;
  if (parent.size >= MAX) { truncated = true; return; }
  parent.set(k, [prev, label, s]); q.push(k);
  (arrive[nodeId] = arrive[nodeId] || []).push(s);
}
const q = [];
const v0 = Object.fromEntries(VARS.map(k => [k, (R.VARS[k] || {}).init || 0]));
for (const c of nextChapters([])) enter(null, CH[c].start, { flags: [], keep: [], vars: v0, done: [] }, `【${c}】`);
const WALK = args[0] === "--walk"; // 随机走不需要先把整张图搜完
for (let qi = 0; qi < q.length && !WALK; qi++) {
  const k = q[qi], s = parent.get(k)[2], n = NODE[s.node];
  if (n.next) { note(n.next, s.node, "→", s); enter(k, n.next, s, null); }
  if (n.choices) {
    const vis = n.choices.filter(c => ok(s, c));
    if (!vis.length && !timeoutOf(n) && !n.next && !n.branch && !n.end) (dead[s.node] = dead[s.node] || k); // 一个选项都不出来、又没有别的出口：死路
    vis.forEach(c => { const s2 = apply(s, c); note(c.next, s.node, `选 ${c.t}`, s2); enter(k, c.next, s2, c.t); });
    const to = timeoutOf(n); if (to) { const s2 = apply(s, to); note(to.next, s.node, "（超时）", s2); enter(k, to.next, s2, "（超时）"); }
  }
  if (n.branch) { const b = pickBranch(n, s); note(b.next, s.node, `⇢ ${[...arr(b.need), ...arr(b.needNot).map(x => "非 " + x)].join("+") || "否则"}`, s); enter(k, b.next, s, null); }
  if (n.end) {
    const t = n.end.type;
    if (t === "ending") { if (!endings[n.end.id]) endings[n.end.id] = k; continue; }
    if (t === "retry" || (t === "loop" && n.end.retry)) continue;
    const done = s.done.includes(n._ch) ? s.done : [...s.done, n._ch];
    const nx = n.end.id ? [n.end.id] : nextChapters(done);
    for (const c of nx) if (CH[c]) enter(k, CH[c].start, { ...s, flags: [], done }, `【${c}】`);
  }
}
function pathOf(k) {
  const out = []; for (let x = k; x; x = parent.get(x)[0]) { const lab = parent.get(x)[1]; if (lab) out.push(lab.length > 14 ? lab.slice(0, 14) + "…" : lab); }
  return out.reverse().join(" → ");
}
const showVars = s => VARS.map(k => `${k}=${s.vars[k] || 0}`).join(" ");
function range(nodeId) {
  const list = arrive[nodeId] || []; if (!list.length) return null;
  return VARS.map(k => { const vs = list.map(s => s.vars[k] || 0); return `${k} ${Math.min(...vs)}–${Math.max(...vs)}`; }).join("，");
}
function why(endNode) { // 走不到的结局：往回找指向它、但条件从没满足过的那个选项或分支
  for (const [id, n] of Object.entries(NODE)) {
    const hits = [...(n.choices || []).filter(c => c.next === endNode).map(c => ["选项「" + c.t.slice(0, 16) + "」", c]), ...(n.branch || []).filter(b => b.next === endNode).map(b => ["分支", b])];
    if (n.next === endNode) hits.push(["next", {}]);
    if (timeoutOf(n) && n.timeout.next === endNode) hits.push(["超时", {}]);
    for (const [what, o] of hits) {
      const reached = arrive[id];
      if (!reached) { console.log(`    上一步 ${id} 就没到过，再往前查：node tools/solve.js ${id}`); continue; }
      console.log(`    ${id} 到过 ${reached.length} 次，${what} 的条件 [${arr(o.need).join(", ") || "无"}${arr(o.needNot).length ? "；没有 " + arr(o.needNot).join(", ") : ""}] 一次都没满足`);
      if (VARS.length) console.log(`      到达 ${id} 时：${range(id)}`);
      const flags = new Set(reached.flatMap(s => [...s.flags, ...s.keep]));
      const miss = arr(o.need).filter(x => !CMP.test(x) && !flags.has(x)); if (miss.length) console.log(`      从没拿到过：${miss.join(" ")}`);
      for (const m of miss) for (const [sid, sn] of Object.entries(NODE)) { // 再往回一层：谁负责设它、那里为什么没设上
        if (arr(sn.set).includes(m) || arr(sn.clue).includes(m)) console.log(`      ${m} 在节点 ${sid} 设：${arrive[sid] ? "到过，却没传到这里" : "这个节点没到过"}`);
        for (const c of [...(sn.choices || []), ...(timeoutOf(sn) ? [Object.assign({ t: "（超时）" }, sn.timeout)] : [])]) if (arr(c.set).includes(m) || arr(c.clue).includes(m))
          console.log(`      ${m} 在 ${sid} 的选项「${c.t.slice(0, 16)}」里设，要 [${arr(c.need).join(", ") || "无"}]；${arrive[sid] ? `到达 ${sid} 时 ${VARS.length ? range(sid) : "（无好感）"}` : `${sid} 没到过`}`);
      }
    }
  }
}
// 顺着 next 往下走到的结局名（给分支标上它通向哪个结局）
function endOf(id) {
  for (let k = 0, x = id; k < 40 && NODE[x]; k++, x = NODE[x].next) { const e = NODE[x].end; if (e) return e.type === "ending" ? `《${e.id} ${(R.ENDINGS[e.id] || {}).name || ""}》` : ""; if (!NODE[x].next) return ""; }
  return "";
}
// 站位（只看谁在台上）：节点 stage 整体换，台词 stage 中途换；说话的人不在台上会自动站上去（旁白、画外音、CG 除外）
const portraitOf = who => { const p = (R.SPEAKERS[who] || {}).portrait; return typeof p === "string" ? p : null; };
const idsOf = st => Object.values(st || {}).map(sp => String(sp).split(/[:@#]/)[0]);
function stageAfter(n, cur) {
  let s = new Set(cur);
  if (n.stage) s = new Set(idsOf(n.stage));
  for (const l of n.lines || []) {
    const o = l[3] && typeof l[3] === "object" ? l[3] : {};
    if (o.stage) s = new Set(idsOf(o.stage));
    const p = portraitOf(l[0]); if (p && !/^cg_/.test(n.scene || "") && l[3] !== "off" && !o.off) s.add(p);
  }
  return [...s].sort().join(",");
}

if (truncated) console.error(`! 状态超过 ${MAX} 个，搜索被截断，下面的「走不到」不一定可信（MAX=… 调大，或用 --walk）`); // 走 stderr：--routes 的 JSON 不能被它弄脏
if (args[0] === "--walk") {
  const N = +(args[1] || 20000), cnt = {}, eg = {}, stuck = { n: 0 };
  const succ = s => { // 一个状态能去的下一步：[节点, 进节点前的状态, 标签]；结局返回 { end }
    const n = NODE[s.node], out = [];
    if (n.next) out.push([n.next, s, null]);
    if (n.choices) { n.choices.filter(c => ok(s, c)).forEach(c => out.push([c.next, apply(s, c), c.t])); const to = timeoutOf(n); if (to) out.push([to.next, apply(s, to), "（超时）"]); }
    if (n.branch) { const b = pickBranch(n, s); out.push([b.next, s, null]); }
    if (n.end) {
      if (n.end.type === "ending") return { end: n.end.id };
      if (n.end.type === "retry" || (n.end.type === "loop" && n.end.retry)) return { end: "（重来）" };
      const done = s.done.includes(n._ch) ? s.done : [...s.done, n._ch];
      for (const c of n.end.id ? [n.end.id] : nextChapters(done)) if (CH[c]) out.push([CH[c].start, { ...s, flags: [], done }, `【${c}】`]);
    }
    return out;
  };
  let seed = 12345; const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; // mulberry32：32 位整数运算，不会像 seed*1103515245 那样超过 2^53 丢精度
  for (let r = 0; r < N; r++) {
    const c0 = nextChapters([])[0]; let s = stepIn(CH[c0].start, { flags: [], keep: [], vars: v0, done: [] }); const labs = [`【${c0}】`]; let end = null;
    for (let i = 0; i < 20000 && !end; i++) {
      const o = succ(s);
      if (!Array.isArray(o)) { end = o.end; break; }
      if (!o.length) break;
      const [id, base, lab] = o[Math.floor(rnd() * o.length)];
      if (!NODE[id]) break;
      if (lab) labs.push(lab); s = stepIn(id, base);
    }
    if (!end) { stuck.n++; continue; }
    cnt[end] = (cnt[end] || 0) + 1; if (!eg[end]) eg[end] = { labs, vars: s.vars };
  }
  for (const [eid, e] of Object.entries(R.ENDINGS)) {
    if (cnt[eid]) console.log(`✓ ${eid}《${e.name}》 随机 ${(cnt[eid] / N * 100).toFixed(2)}%${VARS.length ? "  到达时 " + VARS.map(k => `${k}=${eg[eid].vars[k] || 0}`).join(" ") : ""}\n    ${eg[eid].labs.map(l => (l.length > 14 ? l.slice(0, 14) + "…" : l)).join(" → ")}`);
    else console.log(`- ${eid}《${e.name}》 随机 ${N} 局一次没走到（不等于走不到，用 --endings 或手推）`);
  }
  if (stuck.n) console.log(`! ${stuck.n} 局走到死路（没有出口的节点）`);
  console.log(`\n随机走了 ${N} 局（可见选项等概率，限时选项和超时等概率）`);
  process.exit(0);
}
if (args[0] === "--routes") {
  const labels = k => { const out = []; for (let x = k; x; x = parent.get(x)[0]) { const lab = parent.get(x)[1]; if (lab) out.push(lab); } return out.reverse(); };
  console.log(JSON.stringify(Object.fromEntries(Object.entries(endings).map(([eid, k]) => [eid, labels(k)]))));
  process.exit(0);
}
if (args[0] === "--endings") {
  let bad = 0;
  for (const [eid, e] of Object.entries(R.ENDINGS)) {
    const endNode = Object.keys(NODE).find(id => NODE[id].end && NODE[id].end.type === "ending" && NODE[id].end.id === eid);
    if (!endNode) { console.log(`- ${eid}《${e.name}》：剧本里还没有这个结局`); continue; }
    if (endings[eid]) { const s = parent.get(endings[eid])[2]; console.log(`✓ ${eid}《${e.name}》${VARS.length ? "  到达时 " + showVars(s) : ""}\n    ${pathOf(endings[eid])}`); }
    else { bad++; console.log(`✗ ${eid}《${e.name}》走不到（${endNode}）`); why(endNode); }
  }
  for (const [id, k] of Object.entries(dead)) { bad++; console.log(`✗ 死路：${id} 一个选项都不出来（到达时 ${VARS.map(v => `${v}=${parent.get(k)[2].vars[v] || 0}`).join(" ")}）\n    ${pathOf(k)}`); }
  if (!Object.keys(dead).length) console.log("✓ 没有死路：每个到达的状态都至少有一个选项或出口");
  console.log(`\n搜索了 ${parent.size} 个状态`);
  process.exit(bad ? 1 : 0);
}
if (args[0] === "--vars") {
  const r = range(args[1]); console.log(r ? `到达 ${args[1]} 的 ${arrive[args[1]].length} 种状态：${r}` : `${args[1]} 走不到`); process.exit(r ? 0 : 1);
}
if (args[0] === "--odds") {
  const J = args[1], jn = NODE[J];
  if (!jn) { console.log("用法：node tools/solve.js --odds <判定节点id>（一般是写 branch 的好感判定节点）"); process.exit(2); }
  const cid = jn._ch, entries = arrive[CH[cid].start] || [];
  if (!entries.length) { console.log(`${cid} 走不到，没有入线状态`); process.exit(1); }
  // 分档看判定条件里第一个出现的好感；条件里没有好感就看全部好感之和
  const kv = (jn.branch || []).flatMap(b => [...arr(b.need), ...arr(b.needNot)]).map(k => CMP.exec(k)).filter(Boolean).flatMap(m => [m[1], m[3]]).find(x => VARS.includes(x));
  const score = s => (kv ? s.vars[kv] || 0 : VARS.reduce((a, k) => a + (s.vars[k] || 0), 0));
  const outcome = s => (jn.branch ? `[${jn.branch.indexOf(pickBranch(jn, s))}]` : "到达");
  const memo = new Map(), onPath = new Set();
  function walk(s) { // 从状态 s（刚进节点）随机走：{ 结果: 概率 }
    if (s.node === J) return { [outcome(s)]: 1 };
    const n = NODE[s.node], k = key(s);
    if (memo.has(k)) return memo.get(k);
    if (onPath.has(k)) return { 绕回原处: 1 };
    onPath.add(k);
    let r;
    if (n.end) r = { [n.end.type === "ending" ? `没到：结局 ${n.end.id}` : n.end.type === "chapter" ? "没到：本章结束" : "没到：重来"]: 1 };
    else if (n.next) r = walk(stepIn(n.next, s));
    else if (n.branch) r = walk(stepIn(pickBranch(n, s).next, s));
    else {
      const vis = (n.choices || []).filter(c => ok(s, c)); r = {};
      if (!vis.length) r = { 没有可选项: 1 };
      for (const c of vis) for (const [x, p] of Object.entries(walk(stepIn(c.next, apply(s, c))))) r[x] = (r[x] || 0) + p / vis.length;
    }
    onPath.delete(k); memo.set(k, r); return r;
  }
  function canHit(s0, want) { // 任意选（含超时）能不能在判定点进 want（不写 want = 能不能走到判定点）
    const seen = new Set(), st = [s0];
    while (st.length) {
      const s = st.pop(), k = key(s); if (seen.has(k)) continue; seen.add(k);
      if (s.node === J) { if (want == null || outcome(s) === want) return true; continue; }
      const n = NODE[s.node]; if (n.end) continue;
      if (n.next) st.push(stepIn(n.next, s));
      if (n.branch) st.push(stepIn(pickBranch(n, s).next, s));
      if (n.choices) { for (const c of n.choices.filter(c => ok(s, c))) st.push(stepIn(c.next, apply(s, c))); const to = timeoutOf(n); if (to) st.push(stepIn(to.next, apply(s, to))); }
    }
    return false;
  }
  const can = entries.filter(s => canHit(s, null)); // 只看走得到判定点的入线状态（有的入线状态一开章就分去别处了）
  if (!can.length) { console.log(`${J} 从 ${cid} 的入线状态都走不到`); process.exit(1); }
  const sorted = can.sort((a, b) => score(a) - score(b)), lo = sorted[0], hi = sorted[sorted.length - 1];
  const tiers = score(lo) === score(hi) ? [["唯一一档", lo]] : [["最低", lo], ["最高", hi]];
  console.log(`判定点 ${J}（${cid}），入线 ${entries.length} 种状态${can.length < entries.length ? `（${entries.length - can.length} 种走不到判定点，不算）` : ""}，按 ${kv || "好感总和"} 分档；随机 = 可见选项等概率，不算超时`);
  if (jn.branch) jn.branch.forEach((b, i) => console.log(`  [${i}] ${[...arr(b.need), ...arr(b.needNot).map(x => "非 " + x)].join(" + ") || "否则"} → ${b.next}${endOf(b.next)}`));
  const good = jn.branch ? "[0]" : "到达";
  const res = tiers.map(([name, s]) => {
    const d = walk(s), can = canHit(s, good);
    const odds = Object.entries(d).sort((a, b) => a[0].localeCompare(b[0])).map(([x, p]) => `${x} ${(p * 100).toFixed(1)}%`).join(" · ");
    console.log(`  入线 ${showVars(s) || "（无好感）"}（${name}）：全选最优 → ${good} ${can ? "✓" : "✗"}；随机 → ${odds}`);
    return { name, can, p: d[good] || 0 };
  });
  if (!res[0].can) console.log(`✗ 入线最低全选最优也进不了 ${good}：门槛太高，或本线能加的分不够`);
  const top = res[res.length - 1];
  if (jn.branch && top.p > 0.4) console.log(`! 入线${top.name}随机进 ${good} ${(top.p * 100).toFixed(1)}%，建议 ≤ 40%（估计值）：乱选也能进，门槛偏松`);
  process.exit(0);
}
if (MERGE) {
  // 站位：每个节点进来时可能的在场组合（每章开头清空），最多记 8 种
  const stIn = {};
  for (const c of Object.values(CH)) stIn[c.start] = new Set([""]);
  for (let changed = true, pass = 0; changed && pass < 100; pass++) {
    changed = false;
    for (const [id, n] of Object.entries(NODE)) for (const cur of [...(stIn[id] || [])]) {
      const out = stageAfter(n, cur ? cur.split(",") : []);
      for (const v of [n.next, ...(n.choices || []).map(c => c.next), ...(n.branch || []).map(b => b.next), timeoutOf(n) && n.timeout.next])
        if (NODE[v] && NODE[v]._ch === n._ch) { const s = (stIn[v] = stIn[v] || new Set()); if (!s.has(out) && s.size < 8) { s.add(out); changed = true; } }
    }
  }
  const people = id => [...new Set([...(stIn[id] || [])].map(cur => stageAfter(NODE[id], cur ? cur.split(",") : [])))].map(x => x || "无人").join(" | ");
  let shown = 0;
  for (const [id, routes] of Object.entries(inc)) {
    if (args[1] && NODE[id]._ch !== args[1]) continue;
    const rs = Object.values(routes); if (rs.length < 2) continue;
    shown++;
    // flag / 线索：每条来路上「一直有 ✓ / 有时有 ~ / 没有 ✗」，只列来路之间不一样的
    const mark = r => { const all = r.states.map(s => new Set([...s.flags, ...s.keep])); return k => { const c = all.filter(x => x.has(k)).length; return c === all.length ? "✓" : c ? "~" : "✗"; }; };
    const marks = rs.map(mark), U = [...new Set(rs.flatMap(r => r.states.flatMap(s => [...s.flags, ...s.keep])))].sort();
    const diff = U.filter(k => new Set(marks.map(f => f(k))).size > 1);
    const who = rs.map(r => people(r.from));
    const vr = rs.map(r => VARS.map(k => { const vs = r.states.map(s => s.vars[k] || 0), a = Math.min(...vs), b = Math.max(...vs); return `${k} ${a === b ? a : a + "–" + b}`; }).join(" "));
    const same = !diff.length && new Set(who).size === 1 && new Set(vr).size === 1;
    console.log(`## ${id}（${NODE[id]._ch}）${rs.length} 条来路${NODE[id].stage ? "，本节点重设站位" : ""}${same ? "：没有差异" : ""}`);
    if (!same) rs.forEach((r, i) => console.log(`  ${i + 1}. ← ${r.from} ${r.via.length > 16 ? r.via.slice(0, 16) + "…" : r.via}　在场 ${who[i]}${VARS.length ? "　" + vr[i] : ""}${diff.length ? "　" + diff.map(k => k + marks[i](k)).join(" ") : ""}`));
  }
  console.log(`\n${shown} 个汇合节点；flag / 线索后面：✓ 这条来路一直有，~ 有时有，✗ 没有；在场的人按站位和说话的人推算`);
  process.exit(0);
}
const target = args[0];
if (!NODE[target]) { console.log("用法：node tools/solve.js --endings | <节点id> | --vars <节点id> | --odds <判定节点id> | --merge [章节id]"); process.exit(2); }
const hit = [...parent.keys()].find(k => parent.get(k)[2].node === target);
console.log(hit ? `FOUND：${pathOf(hit)}${VARS.length ? "\n  到达时 " + showVars(parent.get(hit)[2]) : ""}` : `NOT FOUND：${target} 走不到`);
if (!hit) why(target);
process.exit(hit ? 0 : 1);
