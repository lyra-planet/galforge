#!/usr/bin/env node
/* 无浏览器冒烟测试：用最小假 DOM 跑 index.html 里的引擎，随机自动游玩到结局。
 * node tools/playtest.js [局数=40] [种子=1]；游戏目录 = $GAME_DIR，没设就是本脚本的上一级
 * 引擎要满足的接口见 galforge skill 的 references/engine-notes.md「引擎接口」
 * 统计：运行时错误、卡死、到达的结局、节点覆盖率；有崩溃、卡死或断言失败时退出码 1。
 * 定时器用假时钟（setTimeout 按顺序跑，clearTimeout 真的取消）。限时选择有一部分故意不点、等倒计时走完：
 *   写了 timeout 的要走到 timeout.next（引擎认 timeout 才断言，旧引擎超时退回第一项）
 * 另两条断言也是引擎有这个功能才做，跑旧引擎只打印「跳过」：
 *   章节重玩：第一章玩完，从章节页再进一次、同样的选法，离开时数值要和只玩一遍时一样（引擎有 S.snap）
 *   存档失败：localStorage.setItem 抛错时要出现「存档失败」，不能出现「已存到」（引擎里有「存档失败」提示）
 */
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = process.env.GAME_DIR || path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const RUNS = +(process.argv[2] || 40), SEED0 = +(process.argv[3] || 1);
const SCRIPTS = [...html.matchAll(/<script(?: src="([^"]+)")?[^>]*>([\s\S]*?)<\/script>/g)];
const ENGINE = SCRIPTS.filter(m => !m[1]).map(m => m[2]).join("\n");
const HAS = { timeout: /\w\.timeout\b/.test(ENGINE), snap: /\.snap\b/.test(ENGINE), saveFail: /存档失败/.test(html) }; // 新引擎的功能
const EV = { stopPropagation() {}, preventDefault() {} };

function makeWorld(seed, opt = {}) { // opt.noStorage：setItem 抛 QuotaExceededError；opt.log：记下所有写进页面的文字
  let rs = seed; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  const hiddenIds = new Set([...html.matchAll(/id="([^"]+)"[^>]*\shidden[\s>]/g)].map(m => m[1]));
  const knownIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));  // 页面里没有的元素（比如不做 hub）一律当隐藏
  const texts = [], log = v => { if (opt.log) texts.push(String(v)); };
  const ctx2d = { putImageData() {}, drawImage() {}, fillRect() {} };
  class CL { constructor() { this.s = new Set(); } add(c) { this.s.add(c); } remove(c) { this.s.delete(c); } toggle(c, f) { (f ?? !this.s.has(c)) ? this.s.add(c) : this.s.delete(c); } contains(c) { return this.s.has(c); } }
  class El {
    constructor(id) { this.id = id; this.hidden = hiddenIds.has(id) || (id != null && !knownIds.has(id)); this.style = {}; this.dataset = {}; this.children = []; this.classList = new CL(); this._h = ""; this._t = ""; this.width = 0; this.height = 0; }
    setAttribute(k, v) { this["_a_" + k] = v; } getAttribute(k) { return this["_a_" + k] ?? null; }
    append(...c) { this.children.push(...c); } querySelector() { return new El(); } querySelectorAll() { return []; }
    animate() { return {}; } closest() { return new El(); } focus() {} addEventListener(t, f) { this["_on" + t] = f; }
    getContext() { return ctx2d; } get firstChild() { return this.children[0] || new El(); } get offsetWidth() { return 0; }
    set innerHTML(v) { this._h = v; this.children = []; log(v); } get innerHTML() { return this._h; }
    set textContent(v) { this._t = v; log(v); } get textContent() { return this._t; }
    get scrollHeight() { return 0; }
  }
  const els = new Map(); const byId = id => { if (!els.has(id)) els.set(id, new El(id)); return els.get(id); };
  // 假时钟：setTimeout 排队，fire() 取最早排进来的一个跑、时钟跳到它的到点时间
  let clock = 0, tid = 0; const timers = [], intervals = [], errors = [];
  const store = {};
  const win = {
    console: { log() {}, warn: (...a) => errors.push("warn: " + a.join(" ")), error: (...a) => errors.push("error: " + a.join(" ")) },
    document: { getElementById: byId, createElement: () => new El(), querySelectorAll: () => [], activeElement: null, fonts: { ready: Promise.resolve() }, addEventListener() {} },
    setTimeout: (fn, ms) => { timers.push({ id: ++tid, fn, at: clock + (+ms || 0) }); return tid; },
    clearTimeout: id => { const i = timers.findIndex(t => t.id === id); if (i >= 0) timers.splice(i, 1); },
    setInterval: (fn, ms) => { intervals.push({ id: ++tid, fn, ms: +ms || 16 }); return tid; },
    clearInterval: id => { const i = intervals.findIndex(t => t.id === id); if (i >= 0) intervals.splice(i, 1); },
    requestAnimationFrame() {}, cancelAnimationFrame() {}, performance: { now: () => clock }, matchMedia: () => ({ matches: false, addEventListener() {} }),
    localStorage: { getItem: k => store[k] ?? null, removeItem: k => { delete store[k]; },
      setItem: (k, v) => { if (opt.noStorage) { const e = new Error("QuotaExceededError"); e.name = "QuotaExceededError"; throw e; } store[k] = String(v); } },
    location: { search: "" }, URLSearchParams, Audio: class { play() { return Promise.resolve(); } pause() {} },
    ImageData: class { constructor(d, w, h) { this.data = d; this.width = w; this.height = h; } }, addEventListener() {}, Date, Math, JSON, Promise, Object, Array, Set, Map, String, Number, parseInt, isNaN,
  };
  win.window = win; win.globalThis = win;
  const context = vm.createContext(win);
  for (const [, src, body] of SCRIPTS) {
    let code = src ? (fs.existsSync(path.join(ROOT, src)) ? fs.readFileSync(path.join(ROOT, src), "utf8") : "") : body;
    if (!src && code.includes("function boot")) code += "\n;globalThis.__S = () => S; globalThis.__meta = () => meta;";
    vm.runInContext(code, context, { filename: src || "inline" });
  }
  const W = { win, $: byId, byId, timers, intervals, texts, errors: () => errors, rnd: () => rnd(), reseed: s => { rs = s; }, trail: null };
  W.fire = () => { const t = timers.shift(); clock = Math.max(clock, t.at); t.fn(); };
  W.tickIntervals = () => { if (!intervals.length) return false; clock += Math.min(...intervals.map(t => t.ms)); intervals.slice().forEach(t => t.fn()); return true; };
  return W;
}
// 选项没出来时把排着的定时器跑完（打字机、标题卡、换章过渡）
const flush = W => { for (let k = 0; k < 100000 && W.timers.length && W.$("choices").hidden; k++) W.fire(); };
// 不点选项，等倒计时走完；返回这期间进过的节点
function letTimeout(W) {
  W.trail = [];
  for (let k = 0; k < 5000 && !W.$("choices").hidden; k++) if (!(W.timers.length ? (W.fire(), true) : W.tickIntervals())) break;
  const tr = W.trail; W.trail = null; return tr;
}
function wrapGo(W, visited) { // 引擎有全局 go(id) 就包一层：没有台词、一闪而过的节点（branch、纯 next）也算进覆盖率
  const w = W.win; if (typeof w.go !== "function") return;
  const go0 = w.go; w.go = (id, ...rest) => { if (visited) visited.add(id); if (W.trail) W.trail.push(id); return go0(id, ...rest); };
}

const allNodes = new Set(), visited = new Set(), endings = {}; let stuck = 0, crashed = 0, fails = 0;
const NODE = {}, w0 = makeWorld(1).win, FLOW = w0.REG.FLOW || Object.keys(w0.REG.CHAPTERS || {});
for (const c of Object.values(w0.STORY.chapters)) for (const [id, n] of Object.entries(c.nodes)) { NODE[id] = n; allNodes.add(id); }
{ // registry 登记了、index.html 却没加载的章节：浏览器里这章根本不存在，validate 也查不出来
  const miss = Object.keys(w0.REG.CHAPTERS || {}).filter(id => !w0.STORY.chapters[id]);
  if (miss.length) { console.log(`✗ index.html 没加载这些章节：${miss.join(" ")}（加 <script src="story/<id>.js">）`); fails++; }
}
const TO = { fired: 0, withTo: 0, ok: 0, never: 0, bad: new Set() }; // 限时选择等倒计时走完的统计
for (let r = 0; r < RUNS; r++) {
  const W = makeWorld(SEED0 + r * 7919), w = W.win, $ = W.$;
  wrapGo(W, visited);
  let steps = 0, result = null;
  try {
    $("bNew").onclick(EV);
    while (steps++ < 20000) {
      flush(W);
      const S = w.__S(); visited.add(S.node);
      if (!$("ending").hidden) { result = S.node; break; }
      if (!$("hub").hidden) { const opts = $("hubGrid").children.filter(b => !b.disabled); opts[Math.floor(W.rnd() * opts.length)].onclick(EV); continue; }
      if (!$("choices").hidden) {
        const n = NODE[S.node], at = S.node;
        if (n && n.timer && W.rnd() < (n.timeout ? 0.5 : 0.25)) { // 限时选择：这次不点，等它超时
          const tr = letTimeout(W);
          if ($("choices").hidden) {
            TO.fired++;
            if (n.timeout) { TO.withTo++; if (tr.includes(n.timeout.next)) TO.ok++; else TO.bad.add(at); }
            continue;
          }
          TO.never++;
        }
        const vis = $("choices")._vis;
        // 偏好带线索门槛的选项（模拟会用线索的玩家），其余随机
        const gated = vis.filter(c => (c.need || []).length);
        const pick = gated.length && W.rnd() < 0.7 ? gated[Math.floor(W.rnd() * gated.length)] : vis[Math.floor(W.rnd() * vis.length)];
        W.timers.length = 0; w.choose(pick); continue;
      }
      const before = S.node + ":" + S.line;
      w.advance(true);
      flush(W);
      const S2 = w.__S();
      if (S2.node + ":" + S2.line === before && $("choices").hidden && $("ending").hidden && $("hub").hidden) { stuck++; result = "STUCK@" + before; break; }
    }
    if (!result) { stuck++; result = "TOO_LONG"; }
  } catch (e) { crashed++; result = "CRASH " + e.message + " @ " + (w.__S && w.__S().node); console.log(e.stack.split("\n").slice(0, 4).join("\n")); }
  const S = w.__S && w.__S(); const end = result && result.startsWith("__ending") ? (w.__meta().endings.slice(-1)[0]) : result;
  endings[end] = (endings[end] || 0) + 1;
  const errs = W.errors(); if (errs.length) console.log(`run ${r}: ${[...new Set(errs)].slice(0, 5).join(" | ")}`);
  if (r < 3 || !end.startsWith("E")) console.log(`run ${r}: ${end} · steps ${steps} · clues ${S ? S.clues.length : "?"} · done ${S ? S.done.join(",") : ""}`);
}
const unvisited = [...allNodes].filter(n => !visited.has(n));
console.log("\n结局分布:", endings);
console.log(`卡死 ${stuck} · 崩溃 ${crashed} · 节点覆盖 ${allNodes.size - unvisited.length}/${allNodes.size}`);
if (unvisited.length) console.log("未访问:", unvisited.slice(0, 40).join(" "));

// 限时选择：超时要走 timeout
if (TO.fired || TO.never) {
  let line = `限时选择等超时 ${TO.fired} 次`;
  if (TO.withTo) line += HAS.timeout ? `，其中写了 timeout 的 ${TO.withTo} 次、走到 timeout.next ${TO.ok} 次` : `（引擎不认 timeout，写了 timeout 的 ${TO.withTo} 次都退回第一项，跳过断言）`;
  if (TO.never) line += `；${TO.never} 次倒计时没走完（不限时或引擎不用定时器）`;
  console.log(line);
  if (HAS.timeout && TO.bad.size) { fails++; console.log(`✗ 超时没走 timeout.next：${[...TO.bad].join(" ")}`); }
}

// 一直玩到离开 c0（进了别的章 / 结局 / 选章页），返回那一刻的数值；只点选项，不等超时
function playChapter(W, c0) {
  const w = W.win, $ = W.$;
  for (let i = 0, last = "", same = 0; i < 20000; i++) {
    flush(W);
    const S = w.__S();
    if (S.ch !== c0 || !$("ending").hidden || !$("hub").hidden) return JSON.stringify(S.vars);
    if (!$("choices").hidden) { const vis = $("choices")._vis; W.timers.length = 0; w.choose(vis[Math.floor(W.rnd() * vis.length)]); continue; }
    const k = S.node + ":" + S.line; same = k === last ? same + 1 : 0; last = k; if (same > 5) return null;
    w.advance(true);
  }
  return null;
}
// 章节重玩：第一章玩完，从章节页再进第一章，同样的选法再玩一遍，离开时的数值要和第一遍一样
function replayTest() {
  const c0 = typeof FLOW[0] === "string" ? FLOW[0] : null;
  if (!c0) return console.log("· 章节重玩：FLOW 第一项是自选组，跳过");
  for (let t = 0; t < 6; t++) {
    const seed = SEED0 + 101 + t * 31, W = makeWorld(seed), w = W.win, $ = W.$;
    try {
      $("bNew").onclick(EV); flush(W);
      const v0 = JSON.stringify(w.__S().vars);
      W.reseed(seed); const v1 = playChapter(W, c0);
      if (!v1 || v1 === v0) continue; // 这条路线没加数值，看不出加没加两遍，换种子
      const btn = ["bMenuChap", "bChap"].map(id => $(id)).find(b => typeof b.onclick === "function");
      if (!btn) return console.log("· 章节重玩：找不到「章节」按钮（#bMenuChap / #bChap），跳过");
      btn.onclick(EV);
      const title = w.STORY.chapters[c0].title, cell = $("chapGrid").children.find(b => !b.disabled && String(b.innerHTML).includes(`《${title}》`));
      if (!cell) return console.log(`· 章节重玩：章节页里找不到《${title}》，跳过`);
      cell.onclick(EV);
      if (w.__S().ch !== c0) return console.log(`· 章节重玩：点了《${title}》没进 ${c0}，跳过`);
      W.reseed(seed); const v2 = playChapter(W, c0);
      if (!HAS.snap) return console.log(`· 章节重玩：引擎没有章节快照（S.snap），跳过断言；这个引擎重玩一遍 ${v1} → ${v2}`);
      if (v2 === v1) return console.log(`✓ 章节重玩：从章节页再玩一遍 ${c0}，离开时数值 ${v2}，和只玩一遍一样`);
      fails++; return console.log(`✗ 章节重玩：只玩一遍离开 ${c0} 时 ${v1}，从章节页再玩一遍是 ${v2}（数值加了两遍，或快照没恢复）`);
    } catch (e) { fails++; return console.log(`✗ 章节重玩时崩溃：${e.message}`); }
  }
  console.log(`· 章节重玩：试了 6 个种子，${c0} 都没加数值，看不出来，跳过`);
}
// 存档失败：localStorage 写不进去时要如实说
function storageTest() {
  if (!HAS.saveFail) return console.log("· 存档失败：引擎里没有「存档失败」提示，跳过断言");
  const W = makeWorld(SEED0 + 7, { noStorage: true, log: true }), w = W.win, $ = W.$;
  try {
    $("bNew").onclick(EV);
    for (let i = 0; i < 80; i++) { // 先玩几步，让自动存档跑几次
      flush(W);
      if (!$("ending").hidden || !$("hub").hidden) break;
      if (!$("choices").hidden) { W.timers.length = 0; w.choose($("choices")._vis[0]); } else w.advance(true);
    }
    if (typeof $("bSave").onclick === "function") $("bSave").onclick(EV); else if (typeof w.renderSlots === "function") w.renderSlots("save");
    const cell = $("slotGrid").children[0];
    if (cell && typeof cell.onclick === "function") cell.onclick(EV); else return console.log("· 存档失败：找不到存档位（#slotGrid），只查了自动存档");
  } catch (e) { fails++; return console.log(`✗ 存档失败：setItem 抛错时引擎崩溃：${e.message}`); }
  const all = W.texts.join("\n"), told = /存档失败/.test(all), lied = /已存到/.test(all);
  if (told && !lied) return console.log("✓ 存档失败：setItem 抛错时提示了「存档失败」，没说「已存到」");
  fails++; console.log(`✗ 存档失败：setItem 抛错时${told ? "" : "没有提示「存档失败」"}${!told && lied ? "，还" : ""}${lied ? "提示了「已存到」" : ""}`);
}
// 每个结局按 solve.js 找到的最短选法在引擎里实跑一遍：随机游玩到不了的结局，节点也要真跑过
function routeTest() {
  let routes;
  try { routes = JSON.parse(require("child_process").execFileSync(process.execPath, [path.join(__dirname, "solve.js"), "--routes"], { env: Object.assign({ MAX: "3000000" }, process.env, { GAME_DIR: ROOT }), encoding: "utf8", maxBuffer: 1 << 26, stdio: ["ignore", "pipe", "ignore"] })); }
  catch (e) { return console.log("· 结局直达：solve.js --routes 没跑成，跳过（" + String(e.message).split("\n")[0] + "）"); }
  const ok = [], bad = [], skip = [];
  for (const [eid, labs] of Object.entries(routes)) {
    if (!HAS.timeout && labs.includes("（超时）")) { skip.push(eid); continue; } // 旧引擎不认 timeout，超时那条路在引擎里走不出来
    const W = makeWorld(1), w = W.win, $ = W.$, want = labs.filter(l => !/^【.*】$/.test(l));
    wrapGo(W, visited);
    let i = 0, got = null;
    try {
      $("bNew").onclick(EV);
      for (let k = 0; k < 20000; k++) {
        flush(W);
        if (!$("ending").hidden) { got = w.__meta().endings.slice(-1)[0]; break; }
        if (!$("hub").hidden) { got = "选章页"; break; }
        if (!$("choices").hidden) {
          const lab = want[i++];
          if (lab === "（超时）") { letTimeout(W); continue; }
          const c = $("choices")._vis.find(v => v.t === lab);
          if (!c) { got = `第 ${i} 步找不到选项「${String(lab).slice(0, 16)}」`; break; }
          W.timers.length = 0; w.choose(c); continue;
        }
        w.advance(true);
      }
    } catch (e) { got = "崩溃 " + e.message; }
    const errs = W.errors(); if (errs.length) got = (got || "") + "（报错：" + [...new Set(errs)].slice(0, 2).join(" | ") + "）";
    (got === eid ? ok : bad).push(got === eid ? eid : `${eid} → ${got || "没到结局"}`);
  }
  if (bad.length) { fails++; console.log(`✗ 结局直达：${bad.join("；")}`); }
  else console.log(`✓ 结局直达：按 solve 的最短选法实跑，${ok.length} 个结局都到了（${ok.join(" ")}）${skip.length ? `；引擎不认 timeout，跳过要靠超时才到的 ${skip.join(" ")}` : ""}`);
}
replayTest();
storageTest();
routeTest();
const unvisited2 = [...allNodes].filter(n => !visited.has(n));
if (unvisited2.length) console.log(`加上结局直达，节点覆盖 ${allNodes.size - unvisited2.length}/${allNodes.size}；还没跑到：${unvisited2.slice(0, 40).join(" ")}`);
else console.log(`加上结局直达，节点覆盖 ${allNodes.size}/${allNodes.size}`);
if (stuck || crashed || fails) process.exitCode = 1;
