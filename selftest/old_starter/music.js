/* 程序生成配乐与音效（galforge 通用骨架；WebAudio 现场合成，不用任何音频素材）
 * Music.play("t1")  切换配乐（交叉淡入淡出），"none" = 停
 * Music.sfx("door")    播放音效
 * Music.unlock()       第一次用户点击时调用，浏览器才允许出声
 * 换游戏时改：TRACKS（曲目）、SFX（音效）。名字要和 registry.js 的 BGM / SFX 一致（tools/audio_smoke.js 会核对）
 */
(function (root) {
  "use strict";
  let ctx = null, master, musicBus, sfxBus, cur = null, muted = false;
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);

  // 一首曲子 = 每小节一个和弦（MIDI 音高）+ 一个 8 拍的节奏型（每个八分音符弹和弦里的第几个音，-1 休止）
  //   inst：主旋律乐器；bass：每小节弹根音；pad：铺底和弦；pulse：每拍一下低音心跳（紧张感）
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
    musicBus = ctx.createGain(); musicBus.gain.value = 0.5; sfxBus = ctx.createGain(); sfxBus.gain.value = 0.7;
    // 混响：脉冲响应用指数衰减的噪声生成
    const verb = ctx.createConvolver(), len = Math.floor(ctx.sampleRate * 2.4), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    verb.buffer = ir; const wet = ctx.createGain(); wet.gain.value = 0.3; verb.connect(wet); wet.connect(master);
    musicBus.connect(master); musicBus.connect(verb); sfxBus.connect(master); sfxBus.connect(verb);
    setInterval(schedule, 40);
    return true;
  }

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

  /* ---------- 调度：往前排 0.25 秒的音符 ---------- */
  function schedule() {
    if (!cur || !cur.tr) return;
    const tr = cur.tr, eighth = 60 / tr.bpm / 2;
    while (cur.next < ctx.currentTime + 0.25) {
      const t = cur.next, s = cur.step, chord = tr.chords[Math.floor(s / 8) % tr.chords.length], i8 = s % 8, p = tr.pat[i8];
      if (p >= 0) INST[tr.inst](cur.g, chord[p % chord.length] + 12, t, eighth * 2, 0.16);
      if (i8 === 0 && tr.bass) bass(cur.g, chord[0], t, eighth * 8);
      if (i8 === 0 && tr.pad) pad(cur.g, chord, t, eighth * 8);
      if (tr.pulse && i8 % 2 === 0) thump(cur.g, t, 90, 0.25);
      cur.next += eighth; cur.step++;
    }
  }
  function play(name) {
    if (!init() || (cur && cur.name === name)) return;
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;
    if (cur) { const old = cur.g; old.gain.setTargetAtTime(0.0001, now, 0.4); setTimeout(() => old.disconnect(), 3000); }
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, now); g.gain.linearRampToValueAtTime(1, now + 1.2); g.connect(musicBus);
    cur = { name, tr: TRACKS[name] || null, g, step: 0, next: now + 0.1 };
  }

  /* ---------- 音效 ---------- */
  const SFX = {
    click(t) { thump(sfxBus, t, 1800, 0.08); },
    door(t) { thump(sfxBus, t, 120, 0.5); const s = noise(0.5), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = "bandpass"; f.frequency.setValueAtTime(400, t); f.frequency.linearRampToValueAtTime(900, t + 0.4); s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t); env(g, t, 0.05, 0.4, 0.15); },
    chime(t) { [76, 72, 74, 67].forEach((n, i) => INST.bell(sfxBus, n, t + i * 0.5, 0.9, 0.3)); }, // 四音钟声
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

  root.Music = { play, sfx, setMuted, get muted() { return muted; }, unlock() { if (init() && ctx.state === "suspended") ctx.resume(); }, TRACKS, SFX };
})(typeof window !== "undefined" ? window : globalThis);
