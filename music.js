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
  let ctx = null, master, musicBus, sfxBus, ambBus, duck, NB = null, CK = null, HK = null, cur = null, muted = false, ambName = "none", duckV = 1;
  const fading = [], ambs = []; // 淡出中的曲子（淡出期间照常排音符）；在响的环境音（含淡出中的）
  const BASE = { music: 0.5, sfx: 0.7, amb: 0.6 }, VOL = { music: 1, sfx: 1, amb: 1 };
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);

  // 一首曲子 = 和弦进行 + 几层节奏型。一步 = 一个八分音符
  //   chords：每小节一个和弦（MIDI 音高，低到高）；bar：一小节几步，不写 = pat 的长度
  //   inst + pat：主旋律层。pat 每步弹和弦里的第几个音（-1 休止），长度随意，和 bar 不等长就错开循环
  //     oct 比和弦高几个半音（默认 12）· len 一个音响几步（默认 2）· vel 力度（默认 0.16）
  //   layers：再叠几层，每层写法同主旋律层（inst pat oct len vel）
  //   bass：每小节弹根音 · pad：铺底和弦 · drone：根音低八度的嗡鸣，小节之间交叉淡化不断；pad / drone 的数字是音量倍数
  //   pulse：低音心跳。1 = 每两步一下；数组 = 每步的力度（0 不敲），长度随意
  // 《余量》：低频嗡鸣 + 计数器的咔嗒，冷、克制；只有 dawn 的和声里有大三度
  const rest = n => Array(n).fill(-1);
  const TRACKS = {
    // 标题页：D 小调的空五度慢慢换，嗡鸣垫底；玻璃音每 11 步两下、极轻的钟每 19 步一下，和 16 步的小节错开
    theme: { bpm: 44, bar: 16, drone: 1,
      chords: [[50, 57, 62, 64, 69], [46, 53, 62, 64, 69], [43, 50, 62, 65, 70], [45, 52, 62, 64, 69]],
      inst: "glass", pat: [4, -1, -1, 3, ...rest(7)], len: 8, vel: 0.1,
      layers: [{ inst: "bell", pat: [3, ...rest(18)], oct: 24, len: 4, vel: 0.04 }] },
    // 控制室底色：G1 的嗡鸣（49 Hz，贴着 50 Hz 工频）每 8 秒开合一次，第三小节往上蹭半音又回来；每 4 秒一下轻脉冲，偶尔一个很淡的玻璃音
    hum: { bpm: 60, bar: 16, drone: 1, pulse: [0.12, 0, 0, 0, 0, 0, 0, 0],
      chords: [[43, 50, 55, 62], [43, 50, 55, 62], [44, 51, 56, 63], [43, 50, 55, 62]],
      inst: "glass", pat: [3, ...rest(22)], len: 10, vel: 0.05 },
    // 紧张：E 弗里吉亚的低音固定音型，7 步一循环（2+2+3，重音在 1、3、5 步），最后一步小二度往回拽；两轮换一个和弦 E E F D
    pulse: { bpm: 112, bar: 14, drone: 0.6, pulse: [0.22, 0, 0.12, 0, 0.16, 0, 0],
      chords: [[40, 47, 52, 55, 53], [40, 47, 52, 55, 53], [41, 48, 53, 56, 54], [38, 45, 50, 53, 51]],
      inst: "pluck", pat: [0, 0, 2, 0, 1, 0, 4], oct: 0, vel: 0.22,
      layers: [{ inst: "glass", pat: [4, ...rest(9), 3, ...rest(10)], oct: 24, len: 6, vel: 0.06 }] },
    // 安静、难过：Am9 → Fmaj9 → Cmaj7 → Em7，玻璃音往下走、隔得很开，尾音五六秒；底下很淡的嗡鸣，没有鼓
    glass: { bpm: 54, bar: 16, drone: 0.45,
      chords: [[45, 52, 60, 64, 71], [41, 48, 57, 64, 67], [48, 55, 59, 64, 67], [40, 47, 55, 59, 62]],
      inst: "glass", pat: [4, -1, -1, 3, -1, -1, -1, 2, -1, -1], len: 10, vel: 0.11,
      layers: [{ inst: "glass", pat: [2, ...rest(12)], oct: 0, len: 14, vel: 0.06 }] },
    // 黎明：全作第一次有大三度（D 的 F#、G 的 B），pad 第一次铺上来；嗡鸣还在，停在 Asus4 不解决，回到 D 重来
    dawn: { bpm: 58, bar: 16, drone: 0.5, pad: 0.6,
      chords: [[50, 57, 62, 64, 66], [47, 54, 57, 62, 66], [43, 50, 59, 62, 66], [45, 52, 57, 62, 64]],
      inst: "glass", pat: [4, -1, -1, 3, -1, -1, 2, ...rest(5)], len: 8, vel: 0.1,
      layers: [{ inst: "bell", pat: [1, ...rest(8)], len: 6, vel: 0.06 }] },
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
    // 玻璃：几根正弦泛音，高的先衰完；基音旁边一根差 2 音分的，长尾音里慢慢拍动
    glass(out, n, t, dur, vel) {
      for (const [m, a, d] of [[1, 1, 1], [1.0012, 0.5, 1], [2.32, 0.3, 0.4], [4.25, 0.12, 0.2], [6.63, 0.05, 0.1]]) {
        const g = ctx.createGain(); g.connect(out); osc(g, "sine", midi(n) * m, t, dur * d, 1); env(g, t, 0.006, dur * d, vel * a);
      }
    },
    // 嗡鸣：三根失谐的锯齿 + 一根五度 + 一根正弦，过低通，低通从 160 Hz 开到四五百再合上
    //   起、落各占 1/3：每小节排一个 1.5 小节长的，前一个落下时后一个正好起来，接起来不断
    drone(out, n, t, dur, vel) {
      const g = ctx.createGain(), f = bq("lowpass", 160, 2);
      f.frequency.setValueAtTime(160, t); f.frequency.linearRampToValueAtTime(420 + Math.random() * 300, t + dur / 2); f.frequency.linearRampToValueAtTime(160, t + dur);
      chain(f, g, out);
      for (const det of [-9, 0, 7]) osc(f, "sawtooth", midi(n), t, dur, 0.3).detune.value = det;
      osc(f, "sawtooth", midi(n + 7), t, dur, 0.1); osc(g, "sine", midi(n), t, dur, 0.5);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + dur / 3); g.gain.setValueAtTime(vel, t + dur * 2 / 3); g.gain.linearRampToValueAtTime(0, t + dur);
    },
  };
  function bass(out, n, t, dur) { const g = ctx.createGain(); g.connect(out); osc(g, "sine", midi(n - 12), t, dur, 1); env(g, t, 0.02, dur, 0.22); }
  function pad(out, ns, t, dur, lv = 1) {
    const g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 900; f.connect(g); g.connect(out);
    for (const n of ns) for (const det of [-6, 6]) { const o = osc(f, "sawtooth", midi(n), t, dur, 0.05); o.detune.value = det; }
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5 * lv, t + dur * 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  }
  function noise(sec) { const n = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; const s = ctx.createBufferSource(); s.buffer = buf; return s; }
  function thump(out, t, f0, amp) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.3); env(g, t, 0.005, 0.2, amp); }

  /* ---------- 调度：往前排 0.25 秒的音符；淡出中的曲子排到淡完为止 ---------- */
  // 每层的节奏型按自己的长度循环（s % pat.length），和弦按 bar 换；starter 写法（8 步、pulse: 1）照旧
  function notes(p, t1) {
    const tr = p.tr, eighth = 60 / tr.bpm / 2, bar = tr.bar || tr.pat.length, layers = [tr, ...(tr.layers || [])];
    while (p.next < t1 && !(p.until && p.next >= p.until)) {
      const t = p.next, s = p.step, chord = tr.chords[Math.floor(s / bar) % tr.chords.length], i = s % bar;
      for (const L of layers) { const k = L.pat[s % L.pat.length]; if (k >= 0) INST[L.inst](p.g, chord[k % chord.length] + (L.oct ?? 12), t, eighth * (L.len || 2), L.vel || 0.16); }
      if (i === 0 && tr.bass) bass(p.g, chord[0], t, eighth * bar);
      if (i === 0 && tr.pad) pad(p.g, chord, t, eighth * bar, tr.pad);
      if (i === 0 && tr.drone) INST.drone(p.g, chord[0] - 12, t, eighth * bar * 1.5, 0.09 * tr.drone);
      const pv = Array.isArray(tr.pulse) ? tr.pulse[s % tr.pulse.length] : tr.pulse && s % 2 === 0 ? 0.25 : 0;
      if (pv) thump(p.g, t, 90, pv);
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
  // 咔嗒：每一下是 2 毫秒、衰减常数 0.4 毫秒的噪声脉冲。rate = 0 只放一下；rate > 0 按泊松过程撒满 sec 秒（每秒约 rate 下）
  function clickBuf(sec, rate) {
    const sr = ctx.sampleRate, n = Math.floor(sr * sec), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0), w = Math.floor(sr * 0.002);
    for (let at = 0; at < n;) {
      const a = 0.5 + Math.random() * 0.5;
      for (let i = 0; i < w && at + i < n; i++) d[at + i] += a * (Math.random() * 2 - 1) * Math.exp(-i / (sr * 0.0004));
      if (!rate) break;
      at += Math.max(1, Math.floor(-Math.log(1 - Math.random()) / rate * sr));
    }
    return b;
  }
  function clickSrc(buf, loop) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = !!loop; return s; }
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
    geiger: { // 盖革计数器，低计数率：泊松间隔，平均每秒 1.2 下，偶尔两下挨得很近；死时间 30 毫秒
      start() { return []; },
      tick(out, t) {
        if (!CK) CK = clickBuf(0.01, 0);
        const s = clickSrc(CK); chain(s, bq("highpass", 800), gn(0.3 + Math.random() * 0.2), out); s.start(t);
        return Math.max(0.03, -Math.log(1 - Math.random()) / 1.2);
      },
    },
    geigerhi: { // 高计数率：4 秒的密集咔嗒（每秒约 500 下）循环，接近连续的噼啪噪声；0.37 Hz 起伏，像读数在涨落
      start(out, t) {
        if (!HK) HK = clickBuf(4, 500);
        const s = clickSrc(HK, true), g = gn(0.3); chain(s, bq("highpass", 700), g, out); s.start(t, Math.random() * 3.9);
        return [s, lfo(g.gain, 0.37, 0.08, t)];
      },
    },
    pumps: { // 机房：泵的电机（29 Hz 锯齿过 220 Hz 低通，0.6 Hz 一起一伏）+ 100 Hz 电磁嗡 + 风机的低通噪声（20 秒一涨）
      start(out, t) {
        const m = ctx.createOscillator(), mg = gn(0.25), h = ctx.createOscillator(), s = loopNoise(t), fg = gn(0.35);
        m.type = "sawtooth"; m.frequency.value = 29; chain(m, bq("lowpass", 220), mg, out); m.start(t);
        h.frequency.value = 100; chain(h, gn(0.04), out); h.start(t);
        chain(s, bq("lowpass", 380), fg, out);
        return [m, h, s, lfo(mg.gain, 0.62, 0.12, t), lfo(fg.gain, 0.05, 0.1, t)];
      },
    },
    sea: { // 码头：浪（低通噪声，亮度和音量一起 8 秒一涌）+ 海风（带通噪声慢慢游移）+ 隔几秒浪拍一下木桩
      start(out, t) {
        const w = loopNoise(t), wf = bq("lowpass", 500), wg = gn(0.35), a = loopNoise(t), af = bq("bandpass", 900, 0.8), ag = gn(0.12);
        chain(w, wf, wg, out); chain(a, af, ag, out);
        return [w, a, lfo(wf.frequency, 0.12, 350, t), lfo(wg.gain, 0.12, 0.25, t), lfo(af.frequency, 0.05, 400, t), lfo(ag.gain, 0.09, 0.08, t)];
      },
      tick(out, t) { const s = noise(0.8), g = ctx.createGain(); chain(s, bq("lowpass", 700), g, out); s.start(t); env(g, t, 0.04, 0.6, 0.12); return 3 + Math.random() * 5; },
    },
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
    alarm(t) { // 老式双音警报：方波 700 / 540 Hz 每 0.25 秒换一次（换时带一点滑音，电机带的那种），带通压掉刺耳的高次，约 2 秒
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "square"; o.frequency.setValueAtTime(700, t);
      for (let i = 1; i < 8; i++) o.frequency.setTargetAtTime(i % 2 ? 540 : 700, t + i * 0.25, 0.02);
      chain(o, bq("bandpass", 1000, 0.8), g, sfxBus); o.start(t); o.stop(t + 2.1);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.14, t + 0.03); g.gain.setValueAtTime(0.14, t + 1.9); g.gain.linearRampToValueAtTime(0.0001, t + 2.05);
    },
    valve(t) { // 铁阀轮：转三把，每把一声吱嘎（锯齿过窄带通，25 Hz 左右的方波一顿一顿 = 金属干摩擦），最后一声闷响（低频 thump + 低通噪声 + 铁的余振）
      for (let i = 0; i < 3; i++) {
        const t0 = t + i * 0.55, o = ctx.createOscillator(), a = gn(0.5), g = ctx.createGain();
        o.type = "sawtooth"; o.frequency.setValueAtTime(100 + Math.random() * 30, t0); o.frequency.linearRampToValueAtTime(140 + Math.random() * 40, t0 + 0.4);
        chain(o, bq("bandpass", 1000 + i * 180, 6), a, g, sfxBus); o.start(t0); o.stop(t0 + 0.45);
        lfo(a.gain, 22 + Math.random() * 10, 0.5, t0, "square").stop(t0 + 0.45);
        g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(1.2, t0 + 0.05); g.gain.linearRampToValueAtTime(0.0001, t0 + 0.42);
      }
      const te = t + 1.75, s = noise(0.4), g = ctx.createGain();
      thump(sfxBus, te, 110, 0.6); chain(s, bq("lowpass", 500), g, sfxBus); s.start(te); env(g, te, 0.005, 0.3, 0.3);
      INST.bell(sfxBus, 40, te, 0.6, 0.2);
    },
    splash(t) { // 水声：一团噪声泼出去（低通 3 kHz 落到 400 Hz）+ 六个往上滑的小正弦（气泡）
      const s = noise(1.2), f = bq("lowpass", 3000), g = ctx.createGain(); f.frequency.setValueAtTime(3000, t); f.frequency.exponentialRampToValueAtTime(400, t + 1);
      chain(s, f, g, sfxBus); s.start(t); env(g, t, 0.01, 0.9, 0.35);
      for (let i = 0; i < 6; i++) {
        const t0 = t + 0.1 + Math.random() * 0.8, f0 = 400 + Math.random() * 700, o = ctx.createOscillator(), g2 = ctx.createGain();
        o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f0 * 2.2, t0 + 0.06); chain(o, g2, sfxBus); o.start(t0); o.stop(t0 + 0.1); env(g2, t0, 0.003, 0.06, 0.08);
      }
    },
    phone(t) { // 老式座机：小锤 20 Hz 来回敲两个铃碗（两组金属泛音，方波反相调幅），响 1 秒停 1 秒，两响
      for (const t0 of [t, t + 2]) {
        const sq = ctx.createOscillator(), g = ctx.createGain(); sq.type = "square"; sq.frequency.value = 20; g.connect(sfxBus);
        [[1040, 2870], [1290, 3560]].forEach((fs, j) => {
          const a = gn(0.5); chain(sq, gn(j ? -0.5 : 0.5), a.gain); a.connect(g);
          fs.forEach((f, k) => osc(a, "sine", f, t0, 1.2, k ? 0.3 : 1));
        });
        sq.start(t0); sq.stop(t0 + 1);
        g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.12, t0 + 0.02); g.gain.setValueAtTime(0.12, t0 + 1); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.3);
      }
    },
    dosimeter(t) { // 笔式剂量计：比 click 细的一声「嗒」，一个 2 毫秒的咔嗒过 2.5 kHz 高通 + 4.2 kHz 的极短正弦
      if (!CK) CK = clickBuf(0.01, 0);
      const s = clickSrc(CK); chain(s, bq("highpass", 2500), gn(0.35), sfxBus); s.start(t);
      blip(sfxBus, t, 4200, 0.012, 0.05);
    },
  };
  function sfx(name) { if (!init() || !SFX[name]) return; if (ctx.state === "suspended") ctx.resume(); SFX[name](ctx.currentTime + 0.02); }
  function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.1); }
  function setVolume(bus, v) { if (!(bus in VOL)) return; VOL[bus] = v; const b = { music: musicBus, sfx: sfxBus, amb: ambBus }[bus]; if (ctx && b) b.gain.setTargetAtTime(BASE[bus] * v, ctx.currentTime, 0.05); }

  root.Music = { play, vol, amb, sfx, setMuted, setVolume, get muted() { return muted; }, get ambName() { return ambName; },
    unlock() { if (init() && ctx.state === "suspended") ctx.resume(); }, TRACKS, SFX, AMB };
})(typeof window !== "undefined" ? window : globalThis);
