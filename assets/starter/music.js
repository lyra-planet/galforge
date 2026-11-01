/* 程序生成配乐、环境音与音效（GalForge 通用骨架 · MIT License · github.com/lyra-planet/galforge；WebAudio 现场合成，不用任何音频素材）
 * Music.play("t1", fade)     切换配乐：旧曲淡出、新曲淡入 fade 秒（默认 1.2；"none" = 停，默认 3 秒淡出）
 * Music.vol(0.5, sec)        压低 / 恢复音乐（回忆、NVL），sec 秒内过渡
 * Music.amb("rain")          环境音，独立音量，换的时候交叉淡化 1.5 秒；"none" = 停
 * Music.sfx("door")          播放音效
 * Music.setVolume("music" | "sfx" | "amb", 0–1)  设置页的分轨音量
 * Music.unlock()             第一次用户点击时调用，浏览器才允许出声
 * 换游戏时改：TRACKS（曲目）、SFX（音效）、AMB（环境音）。名字要和 registry.js 的 BGM / SFX / AMB 一致（tools/audio_smoke.js 会核对）
 */
(function (root) {
  "use strict";
  let ctx = null, master, musicBus, sfxBus, ambBus, duck, NB = null, cur = null, muted = false, ambName = "none", duckV = 1;
  const fading = [], ambs = []; // 淡出中的曲子（淡出期间照常排音符）；在响的环境音（含淡出中的）
  const BASE = { music: 0.5, sfx: 0.7, amb: 0.6 }, VOL = { music: 1, sfx: 1, amb: 1 };
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);

  // 一首曲子 = 每小节一个和弦（MIDI 音高）+ 一个 8 拍的节奏型（每个八分音符弹和弦里的第几个音，-1 休止）
  //   inst：主旋律乐器；bass：每小节弹根音；pad：铺底和弦；pulse：每拍一下低音心跳（紧张感）
  // 下面 6 首是示范用，本作的曲目按情绪地图重写：名字、乐器、几首都从构思来（id 和 registry.js 的 BGM 对上）
  const TRACKS = {
    t1: { bpm: 104, inst: "pluck", chords: [[60, 64, 67, 72], [57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67]], pat: [0, 2, 1, 3, 0, 2, 3, 1], bass: 1 },
    t2: { bpm: 132, inst: "pluck", chords: [[62, 66, 69], [64, 67, 71], [62, 66, 69], [57, 61, 64]], pat: [0, -1, 2, 1, -1, 2, 0, -1], bass: 1, pulse: 1 },
    t3: { bpm: 76, inst: "bell", chords: [[65, 69, 72, 76], [64, 67, 71, 74], [62, 65, 69, 72], [60, 64, 67, 71]], pat: [0, 2, 3, 2, 1, 2, 3, -1], pad: 1, bass: 1 },
    t4: { bpm: 68, inst: "piano", chords: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 67]], pat: [0, 2, 1, 3, 2, 1, 3, 2], bass: 1 },
    t5: { bpm: 58, inst: "piano", chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], pat: [0, -1, 2, -1, 1, -1, 2, -1], pad: 1 },
    t6: { bpm: 96, inst: "pluck", chords: [[57, 60, 64], [57, 60, 63], [53, 57, 60], [52, 56, 59]], pat: [0, 0, 2, 0, 1, 0, 2, 1], bass: 1, pulse: 1 },
  };

  function init() {
    if (ctx) return true;
    const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = BASE.music * VOL.music; sfxBus = ctx.createGain(); sfxBus.gain.value = BASE.sfx * VOL.sfx;
    ambBus = ctx.createGain(); ambBus.gain.value = BASE.amb * VOL.amb; ambBus.connect(master);
    duck = ctx.createGain(); duck.gain.value = duckV; duck.connect(musicBus); // 曲子 → duck（bgmVol 压低）→ musicBus（设置页音量）
    // 混响：脉冲响应用指数衰减的噪声生成
    const verb = ctx.createConvolver(), len = Math.floor(ctx.sampleRate * 2.4), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    verb.buffer = ir; const wet = ctx.createGain(); wet.gain.value = 0.3; verb.connect(wet); wet.connect(master);
    musicBus.connect(master); musicBus.connect(verb); sfxBus.connect(master); sfxBus.connect(verb);
    setInterval(schedule, 40);
    return true;
  }
  // 把一个参数从当前值平滑拉到 v（sec 秒，线性）
  function ramp(p, v, sec) { const t = ctx.currentTime; p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(v, t + Math.max(0.02, sec)); }

  /* ---------- 乐器 ---------- */
  function env(g, t, a, d, peak) {
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function osc(out, type, f, t, dur, amp) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f; g.gain.value = amp;
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.1); return o;
  }
  const INST = {
    piano(out, n, t, dur, vel) { const g = ctx.createGain(); g.connect(out); for (const [m, ty, a] of [[1, "triangle", 1], [2, "sine", 0.35], [3, "sine", 0.12]]) osc(g, ty, midi(n) * m, t, dur, a); env(g, t, 0.006, dur, vel); },
    pluck(out, n, t, dur, vel) {
      const g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(2400, t); f.frequency.exponentialRampToValueAtTime(300, t + dur);
      f.connect(g); g.connect(out); osc(f, "sawtooth", midi(n), t, dur, 1); env(g, t, 0.004, dur * 0.8, vel * 0.6);
    },
    bell(out, n, t, dur, vel) { const g = ctx.createGain(); g.connect(out); osc(g, "sine", midi(n), t, dur * 2, 1); osc(g, "sine", midi(n) * 2.76, t, dur, 0.3); env(g, t, 0.003, dur * 2, vel * 0.7); },
  };
  function bass(out, n, t, dur) { const g = ctx.createGain(); g.connect(out); osc(g, "sine", midi(n - 12), t, dur, 1); env(g, t, 0.02, dur, 0.22); }
  function pad(out, ns, t, dur) {
    const g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 900; f.connect(g); g.connect(out);
    for (const n of ns) for (const det of [-6, 6]) { const o = osc(f, "sawtooth", midi(n), t, dur, 0.05); o.detune.value = det; }
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5, t + dur * 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  }
  function noise(sec) { const n = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; const s = ctx.createBufferSource(); s.buffer = buf; return s; }
  function thump(out, t, f0, amp) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.3); env(g, t, 0.005, 0.2, amp); }

  /* ---------- 调度：往前排 0.25 秒的音符；淡出中的曲子排到淡完为止 ---------- */
  function notes(p, t1) {
    const tr = p.tr, eighth = 60 / tr.bpm / 2;
    while (p.next < t1 && !(p.until && p.next >= p.until)) {
      const t = p.next, s = p.step, chord = tr.chords[Math.floor(s / 8) % tr.chords.length], i8 = s % 8, k = tr.pat[i8];
      if (k >= 0) INST[tr.inst](p.g, chord[k % chord.length] + 12, t, eighth * 2, 0.16);
      if (i8 === 0 && tr.bass) bass(p.g, chord[0], t, eighth * 8);
      if (i8 === 0 && tr.pad) pad(p.g, chord, t, eighth * 8);
      if (tr.pulse && i8 % 2 === 0) thump(p.g, t, 90, 0.25);
      p.next += eighth; p.step++;
    }
  }
  function schedule() {
    const now = ctx.currentTime, t1 = now + 0.25;
    if (cur && cur.tr) notes(cur, t1);
    for (let i = fading.length - 1; i >= 0; i--) { const p = fading[i]; if (p.tr) notes(p, t1); if (now > p.until + 4) { p.g.disconnect(); fading.splice(i, 1); } }
    for (let i = ambs.length - 1; i >= 0; i--) {
      const a = ambs[i], tick = AMB[a.name] && AMB[a.name].tick;
      if (tick) while (a.next < t1 && !(a.until && a.next >= a.until)) a.next += tick(a.g, a.next, a);
      if (a.until && now > a.until + 0.5) { a.g.disconnect(); ambs.splice(i, 1); }
    }
  }
  function play(name, fade) {
    if (!init() || (cur && cur.name === name)) return;
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime, f = fade != null ? fade : name === "none" ? 3 : 1.2;
    if (cur) { const p = cur; ramp(p.g.gain, p.g.gain.value, 0.02); p.g.gain.setTargetAtTime(0.0001, now + 0.02, f / 3); p.until = now + f; fading.push(p); } // 时间常数 f/3：f 秒后降到 5%
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, now); g.gain.linearRampToValueAtTime(1, now + f); g.connect(duck);
    cur = { name, tr: TRACKS[name] || null, g, step: 0, next: now + 0.1 };
  }
  function vol(v, sec = 1) { duckV = v; if (ctx) ramp(duck.gain, v, sec); }

  /* ---------- 环境音：噪声 + 滤波器合成。start 搭好常驻的声音、返回要停的源；tick 排一次零碎的声音（虫鸣、钟摆），返回隔几秒再排 ---------- */
  function loopNoise(t) { // 2 秒噪声循环播放，起点随机，几路叠起来不会同相
    if (!NB) { const n = Math.floor(ctx.sampleRate * 2); NB = ctx.createBuffer(1, n, ctx.sampleRate); const d = NB.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; }
    const s = ctx.createBufferSource(); s.buffer = NB; s.loop = true; s.start(t, Math.random() * 1.9); return s;
  }
  function bq(type, f, q) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; return b; }
  function gn(v) { const g = ctx.createGain(); g.gain.value = v; return g; }
  function chain(...ns) { for (let i = 0; i + 1 < ns.length; i++) ns[i].connect(ns[i + 1]); return ns[0]; }
  function lfo(param, hz, depth, t, type = "sine") { const o = ctx.createOscillator(), g = gn(depth); o.type = type; o.frequency.value = hz; chain(o, g, param); o.start(t); return o; }
  function blip(out, t, f, dur, amp) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.value = f; chain(o, g, out); o.start(t); o.stop(t + dur + 0.05); env(g, t, 0.004, dur, amp); }
  const AMB = {
    rain: { start(out, t) { const s = loopNoise(t), g = gn(0.5); chain(s, bq("highpass", 300), bq("lowpass", 1400), g, out); return [s, lfo(g.gain, 0.13, 0.15, t)]; } },
    cicada: { start(out, t) { // 带通 5 kHz、Q 8，25 Hz 方波调幅（蝉的颤音），0.2 Hz 慢慢涌起
      const s = loopNoise(t), am = gn(0.5), sw = gn(0.9); chain(s, bq("bandpass", 5000, 8), am, sw, out);
      return [s, lfo(am.gain, 25, 0.5, t, "square"), lfo(sw.gain, 0.2, 0.5, t)];
    } },
    wind: { start(out, t) { const s = loopNoise(t), f = bq("bandpass", 600, 1.2), g = gn(0.7); chain(s, f, g, out); return [s, lfo(f.frequency, 0.07, 300, t), lfo(g.gain, 0.11, 0.35, t)]; } },
    waves: { start(out, t) { const s = loopNoise(t), g = gn(0.35); chain(s, bq("lowpass", 600), g, out); return [s, lfo(g.gain, 0.1, 0.32, t)]; } },
    crowd: { // 低低的人声底 + 零碎的说话声
      start(out, t) { const s = loopNoise(t); chain(s, bq("bandpass", 500, 0.8), gn(0.12), out); return [s]; },
      tick(out, t) { const s = noise(0.3), g = ctx.createGain(); chain(s, bq("bandpass", 300 + Math.random() * 900, 3), g, out); s.start(t); env(g, t, 0.03, 0.22, 0.12); return 0.12 + Math.random() * 0.3; },
    },
    night: { // 夜里的虫鸣：4.5 kHz 短脉冲三连
      start() { return []; },
      tick(out, t) { for (let i = 0; i < 3; i++) blip(out, t + i * 0.07, 4500, 0.03, 0.05); return 0.6 + Math.random() * 0.8; },
    },
    clock: { start() { return []; }, tick(out, t, a) { a.k = (a.k || 0) + 1; thump(out, t, a.k % 2 ? 2000 : 1600, 0.1); return 1; } }, // 滴、答
  };
  function amb(name) {
    if (name === ambName || !init()) return;
    ambName = name;
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;
    for (const a of ambs) if (!a.until) { ramp(a.g.gain, 0, 1.5); a.until = now + 1.5; a.src.forEach(n => n.stop(now + 1.6)); }
    if (!AMB[name]) return;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(1, now + 1.5); g.connect(ambBus);
    ambs.push({ name, g, src: AMB[name].start(g, now), next: now + 0.1, until: 0 });
  }

  /* ---------- 音效 ---------- */
  const SFX = {
    click(t) { thump(sfxBus, t, 1800, 0.08); },
    door(t) { thump(sfxBus, t, 120, 0.5); const s = noise(0.5), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = "bandpass"; f.frequency.setValueAtTime(400, t); f.frequency.linearRampToValueAtTime(900, t + 0.4); s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t); env(g, t, 0.05, 0.4, 0.15); },
    chime(t) { [76, 72, 74, 67].forEach((n, i) => INST.bell(sfxBus, n, t + i * 0.5, 0.9, 0.3)); }, // 四音钟声（报时、提示音）
    bell(t) { INST.bell(sfxBus, 88, t, 0.5, 0.35); INST.bell(sfxBus, 84, t + 0.32, 0.7, 0.35); }, // 门铃「叮咚」
    heartbeat(t) { for (const d of [0, 0.22, 0.9, 1.12]) thump(sfxBus, t + d, 70, 0.6); },
    pop(t) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.setValueAtTime(500, t); o.frequency.exponentialRampToValueAtTime(1400, t + 0.08); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.15); env(g, t, 0.005, 0.1, 0.2); }, // 表情符号冒出来
    whoosh(t) { const s = noise(0.6), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = "bandpass"; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(3000, t + 0.4); s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t); env(g, t, 0.08, 0.4, 0.25); },
    rain(t) { const s = noise(3), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = "lowpass"; f.frequency.value = 1400; s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.18, t + 0.6); g.gain.linearRampToValueAtTime(0.0001, t + 3); },
    crowd(t) { for (let i = 0; i < 14; i++) { const s = noise(0.25), f = ctx.createBiquadFilter(), g = ctx.createGain(), d = Math.random() * 1.6; f.type = "bandpass"; f.frequency.value = 600 + Math.random() * 900; f.Q.value = 1.5; s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t + d); env(g, t + d, 0.02, 0.2, 0.12); } }, // 人群哄笑 / 鼓掌
    glass(t) { const s = noise(0.6), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = "highpass"; f.frequency.value = 3000; s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t); env(g, t, 0.002, 0.5, 0.3); for (const n of [96, 101, 105]) INST.bell(sfxBus, n, t + Math.random() * 0.08, 0.3, 0.2); },
  };
  function sfx(name) { if (!init() || !SFX[name]) return; if (ctx.state === "suspended") ctx.resume(); SFX[name](ctx.currentTime + 0.02); }
  function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.1); }
  function setVolume(bus, v) { if (!(bus in VOL)) return; VOL[bus] = v; const b = { music: musicBus, sfx: sfxBus, amb: ambBus }[bus]; if (ctx && b) b.gain.setTargetAtTime(BASE[bus] * v, ctx.currentTime, 0.05); }

  root.Music = { play, vol, amb, sfx, setMuted, setVolume, get muted() { return muted; }, get ambName() { return ambName; },
    unlock() { if (init() && ctx.state === "suspended") ctx.resume(); }, TRACKS, SFX, AMB };
})(typeof window !== "undefined" ? window : globalThis);
