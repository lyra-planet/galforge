#!/usr/bin/env node
/* 配乐冒烟测试：用假 AudioContext 把 registry 里登记的每首 BGM、每个 SFX、每种环境音（AMB）都执行一遍，只查会不会抛错。
 * node tools/audio_smoke.js
 * playtest.js 里没有 AudioContext，music.js 在那里一行都没真正跑过，所以要单独测。
 * 还核对名字：registry 的 BGM / SFX / AMB 在 music.js 的 TRACKS / SFX / AMB 里都要有（没有的话游戏里静默不出声）
 * 新接口有就测、没有就跳过：play(name, fade)、Music.vol(v, sec)、Music.amb(name)、setVolume("music"|"sfx"|"amb", v)
 * 游戏目录 = $GAME_DIR，没设就是本脚本的上一级
 */
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = process.env.GAME_DIR || path.join(__dirname, "..");
const R = require(path.join(ROOT, "story", "registry.js"));

const clock = { t: 0 };
// 任何属性、任何调用都返回一个新的假节点；只有少数几个字段给真数值
const fake = () => new Proxy(function () {}, {
  get: (_, k) => k === "value" ? 1 : k === "sampleRate" ? 8000 : k === "currentTime" ? clock.t : k === "state" ? "running"
    : k === "length" ? 8 : k === "getChannelData" ? () => new Float32Array(16000) : fake(),
  apply: () => fake(), set: () => true,
});
class FakeAC {
  constructor() {
    return new Proxy({}, { get: (_, k) => k === "currentTime" ? clock.t : k === "sampleRate" ? 8000 : k === "state" ? "running"
      : k === "createBuffer" ? (ch, len, sr) => ({ length: len, numberOfChannels: ch, sampleRate: sr, duration: len / sr, getChannelData: () => new Float32Array(len || 20000) }) : () => fake() });
  }
}
// 定时器也用假时钟：setInterval 全部记下每步都跑；setTimeout 到点才跑（环境音的循环触发、旧曲淡出后断开都靠它）
const ticks = [], timers = [];
const g = { AudioContext: FakeAC, setInterval: f => ticks.push(f), clearInterval: id => { ticks[id - 1] = null; },
  setTimeout: (f, ms) => timers.push({ f, at: clock.t + (ms || 0) / 1000 }), clearTimeout: id => { if (timers[id - 1]) timers[id - 1].f = null; }, Math, Float32Array, console };
g.window = g;
vm.runInNewContext(fs.readFileSync(path.join(ROOT, "music.js"), "utf8"), g, { filename: "music.js" });
const M = g.Music;
const tick = sec => { for (let i = 0; i < sec * 5; i++) { clock.t += 0.2; ticks.forEach(f => f && f()); for (const t of timers) if (t.f && t.at <= clock.t) { const f = t.f; t.f = null; f(); } } };

let bad = 0;
const run = (what, fn) => { try { fn(); } catch (e) { bad++; console.log(`  ✗ ${what}: ${e.message}`); } };
const has = (list, table, what) => { if (table) for (const n of list) if (!(n in table)) { bad++; console.log(`  ✗ registry 登记了${what} ${n}，music.js 里没有`); } };
const BGM = R.BGM.filter(n => n !== "none"), AMB = (R.AMB || []).filter(n => n !== "none");
has(BGM, M.TRACKS, " BGM"); has(R.SFX, M.SFX, " SFX"); has(AMB, M.AMB, "环境音");
for (const name of BGM) run(`bgm ${name}`, () => { M.play(name); tick(12); });
run("bgm none（淡出）", () => { M.play("none"); tick(4); });
if (BGM.length) run(`bgm ${BGM[0]} 带淡入`, () => { M.play(BGM[0], 4); tick(6); });
if (typeof M.vol === "function") run("Music.vol 压低再恢复", () => { M.vol(0.4, 1); tick(2); M.vol(1, 1); tick(2); });
if (typeof M.setVolume === "function") run("setVolume 三路", () => ["music", "sfx", "amb"].forEach(k => M.setVolume(k, 0.5)));
for (const name of R.SFX) run(`sfx ${name}`, () => M.sfx(name));
let amb = "没有登记";
if (AMB.length && typeof M.amb !== "function") { bad++; console.log("  ✗ registry 登记了 AMB，music.js 却没有 Music.amb()"); }
else if (typeof M.amb !== "function") amb = "music.js 没有 amb()，跳过";
else if (AMB.length) {
  for (const name of AMB) run(`amb ${name}`, () => { M.amb(name); tick(8); });
  run("amb none", () => { M.amb("none"); tick(3); });
  amb = `${AMB.length} 种`;
}
console.log(`BGM ${BGM.length} 首 · SFX ${R.SFX.length} 种 · 环境音 ${amb} · ${bad} 个报错`);
process.exit(bad ? 1 : 0);
