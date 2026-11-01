/* 像素美术引擎（GalForge 通用骨架 · galgame 版 · MIT License · github.com/lyra-planet/galforge）
 * 画面 480×270；立绘 112×210 半身，日系大眼；全部代码绘制，不用任何图片素材。
 * 浏览器里挂 window.PixelArt；node 里 require 后可导出 PNG（tools/render_png.js）。
 * 换游戏时改：PAL（色表，可加）、CAST（角色参数）、SCENES（场景）。PB、bust()、frame() 一般不用动。
 *
 * bust(角色, 表情, { blink: 0 睁 / 1 半闭 / 2 闭, talk: 0 / 1 张嘴, outfit: 服装名, pose: 姿势 })：静态立绘
 * compose(角色, { ex, blink, talk, outfit, pose, poseFrom, poseK, act, actT }, t)：按时间拼一帧（呼吸、晃头、姿势过渡、点头摇头……）
 * frame(场景, t, { chars: [{ id, pos: "l"|"c"|"r"|x, ex, outfit, blink, talk, pose, poseFrom, poseK, act, actT, dim, alpha, dy, emote, emoteT }], tod, red })
 */
(function (root) {
  "use strict";

  /* ---------- 调色板 ---------- */
  const PAL = {
    ink: "#16131c", outline: "#2a1d33", night: "#1f1d2b", deep: "#2d2b3e", shadow: "#433f58", dusk: "#625d79",
    grey: "#908da0", silver: "#c8cad6", white: "#f7f4ee", cream: "#fff5df",
    skinS: "#d98f7f", skinD: "#efb39c", skin: "#fbd4bd", skinL: "#fff0e4",
    blushD: "#ec8a93", blush: "#f6b0b4", lid: "#f4b3aa", lashL: "#8a4a4a", lip: "#b8505a",
    hairB: "#1f1a24", hairB2: "#3a3247", hairB3: "#5d5274",
    brownD: "#4a2c22", brown: "#7a4a33", brownL: "#b07650",
    goldD: "#a8742a", gold: "#e8b64c", goldL: "#ffe08a",
    sakuraD: "#c25b84", sakura: "#f08fb4", sakuraL: "#ffc8dc",
    silverD: "#8a8ea8", silverM: "#c3c8dc", silverL: "#eef0fa",
    redD: "#6e1c2a", red: "#c13a45", rose: "#e5707a",
    navy: "#25304f", navyM: "#384a78", blueD: "#3e5f97", blue: "#6f95cf", blueL: "#a9c6ee",
    greenD: "#22463a", green: "#3e7a5c", jade: "#79b58f",
    violetD: "#4b3473", violet: "#7d5fb4", violetL: "#b9a3e3",
    woodD: "#4a3226", wood: "#7a5438", woodL: "#a97a52", amber: "#d39552", light: "#fbe7b0",
    sky: "#8ec3ea", skyL: "#cfe6f7", sunset: "#f29a62", sunsetL: "#ffd09a", sunsetP: "#c86b8f",
    tealD: "#1f3d42", teal: "#36666a", mist: "#93bdb4", fog: "#cfe0d8",
    // ---- 《余量》人物 ----
    skinT: "#ecbd9f", ashD: "#4e5056", ash: "#8d9096", ashL: "#c9cbcd", // 郑岩：晒过的肤色、灰白寸头
    fbD: "#26170f", fbM: "#45291c", fbL: "#6b4430", bkM: "#2a2a31", bkL: "#4c4c57", // 方以宁：深棕发；邝丽娟：不发紫的黑
    nvD: "#151b29", nvM: "#232d43", nvL: "#3a4862", ptD: "#121722",    // 值班长的深藏青工作服、工装裤
    gbD: "#33424f", gbM: "#4f6374", gbL: "#7d93a6",                      // 操作员：浅一档的灰蓝
    ctD: "#97a3a3", ctM: "#dfe4e1", ctL: "#f3f6f2",                      // 白大褂
    swD: "#1b161d", swM: "#2d2530", swL: "#463a4a",                      // 深色高领毛衣
    stD: "#8c9895", stM: "#d3d9d4", stL: "#ebefea", gvD: "#97803b", gvM: "#cfb35a", // 防护服、黄胶皮手套
    mapD: "#8f8a74", mapM: "#d8d2b8", mapL: "#efeadb", lbD: "#1d2f27", lbM: "#2f4a3d", // 图纸、记录本的深绿布面
    // ---- 《余量》场景：冷绿暗底、切伦科夫蓝、警示琥珀 ----
    g0: "#0a1110", g1: "#111b1a", g2: "#192725", g3: "#223532", g4: "#2f4843", g5: "#43625b", g6: "#5f8077", g7: "#88a89e", g8: "#bfd2ca",
    ck0: "#061a33", ck1: "#0b3a7c", ck2: "#1a69cc", ck3: "#41a0f7", ck4: "#93d2ff", ck5: "#e2f5ff",
    am0: "#3f2508", am1: "#8f530f", am2: "#de8d1d", am3: "#ffc24f", am4: "#fff0c2",
    rd0: "#3e0f0e", rd1: "#9a211b", rd2: "#ee4b35", rd3: "#ff9a82",
    cn0: "#262a29", cn1: "#3d4341", cn2: "#59605e", cn3: "#7c8481", cn4: "#a3aaa6", cn5: "#cdd2cd", // 混凝土、钢
    pn0: "#26332f", pn1: "#41544d", pn2: "#5b7068", pn3: "#7e938a", pn4: "#aebdb4",                  // 仪表盘的灰绿漆
    mf: "#e3e0cf", mfN: "#a9d1b4", paper: "#e6e2cf",                                                  // 表盘（白天 / 夜里背光）、记录纸
    rs0: "#2b180f", rs1: "#552d17", rs2: "#88461f", rs3: "#b9743a", hz: "#d4a72c",                    // 锈、黄黑警示线的黄
    sea0: "#0b1418", sea1: "#132228", sea2: "#1e353c", sea3: "#30525a", sea4: "#58808a",
    dn0: "#26313f", dn1: "#3f5064", dn2: "#677b90", dn3: "#9caebd", dn4: "#cbd5da",                  // 黎明前的灰蓝天
    nightK: "#6f8ca6", dawnK: "#a3b3c6",                                                              // 时段调色：夜里冷青、黎明灰蓝
  };
  const C = {};
  for (const k in PAL) { const h = PAL[k]; C[k] = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  const col = c => (typeof c === "string" ? C[c] : c);
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

  /* ---------- 像素缓冲 ---------- */
  class PB {
    // bx0..bx1 / by0..by1 = 画到过的范围：描边、阴影、贴图只扫这一块（立绘的图层大多是稀疏的，快好几倍）
    constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); this.bx0 = w; this.by0 = h; this.bx1 = -1; this.by1 = -1; }
    px(x, y, c) {
      x = Math.floor(x); y = Math.floor(y); c = col(c);
      if (!c || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      const i = (y * this.w + x) * 4; this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = 255;
      if (x < this.bx0) this.bx0 = x; if (x > this.bx1) this.bx1 = x; if (y < this.by0) this.by0 = y; if (y > this.by1) this.by1 = y;
    }
    touch() { this.bx0 = 0; this.by0 = 0; this.bx1 = this.w - 1; this.by1 = this.h - 1; } // 直接改了 d 的函数调用它
    box(m = 1) { return [Math.max(0, this.bx0 - m), Math.max(0, this.by0 - m), Math.min(this.w - 1, this.bx1 + m), Math.min(this.h - 1, this.by1 + m)]; }
    a(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.d[(y * this.w + x) * 4 + 3]; }
    rect(x, y, w, h, c) { // 场景里用得最多：颜色只换算一次，直接写；被平移 / 镜像画笔包着时（px 换过了）照旧逐点画，不然会画错位置
      if (this.px !== PB.prototype.px) { for (let j = Math.floor(y); j < y + h; j++) for (let i = Math.floor(x); i < x + w; i++) this.px(i, j, c); return; }
      const cc = col(c); if (!cc) return;
      const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y)), x1 = Math.min(this.w, Math.floor(x + w)), y1 = Math.min(this.h, Math.floor(y + h));
      if (x0 >= x1 || y0 >= y1) return;
      for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) { const p = (j * this.w + i) * 4; this.d[p] = cc[0]; this.d[p + 1] = cc[1]; this.d[p + 2] = cc[2]; this.d[p + 3] = 255; }
      if (x0 < this.bx0) this.bx0 = x0; if (x1 - 1 > this.bx1) this.bx1 = x1 - 1; if (y0 < this.by0) this.by0 = y0; if (y1 - 1 > this.by1) this.by1 = y1 - 1;
    }
    dith(x, y, w, h, c, t, keep) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (bay(i, j) < t && (!keep || keep(i, j))) this.px(i, j, c); }
    ell(cx, cy, rx, ry, c, keep, t = 1) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
          if (dx * dx + dy * dy <= 1 && (!keep || keep(x, y)) && (t >= 1 || bay(x, y) < t)) this.px(x, y, c);
        }
    }
    poly(pts, c, t = 1, keep) {
      let y0 = 1e9, y1 = -1e9;
      for (let i = 1; i < pts.length; i += 2) { y0 = Math.min(y0, pts[i]); y1 = Math.max(y1, pts[i]); }
      const n = pts.length / 2;
      for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
        const yy = y + 0.5, xs = [];
        for (let i = 0; i < n; i++) {
          const ax = pts[i * 2], ay = pts[i * 2 + 1], bx = pts[((i + 1) % n) * 2], by = pts[((i + 1) % n) * 2 + 1];
          if ((ay <= yy && by > yy) || (by <= yy && ay > yy)) xs.push(ax + ((yy - ay) / (by - ay)) * (bx - ax));
        }
        xs.sort((p, q) => p - q);
        for (let k = 0; k + 1 < xs.length; k += 2)
          for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) if ((t >= 1 || bay(x, y) < t) && (!keep || keep(x, y))) this.px(x, y, c);
      }
    }
    line(x0, y0, x1, y1, c) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let e = dx + dy;
      for (;;) { this.px(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
    }
    // 折线：pts = [x0,y0,x1,y1,...]
    path(pts, c) { for (let i = 0; i + 3 < pts.length; i += 2) this.line(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], c); }
    vgrad(x, y, w, h, stops) {
      const n = stops.length - 1;
      for (let j = 0; j < h; j++) {
        const f = h > 1 ? (j / (h - 1)) * n : 0, i = Math.min(n - 1, Math.floor(f)), fr = f - i;
        for (let k = 0; k < w; k++) this.px(x + k, y + j, bay(x + k, y + j) < fr ? stops[i + 1] : stops[i]);
      }
    }
    // alpha < 1 时按抖动只画一部分像素（像素风的淡入淡出）；dim > 0 时整体压暗
    blit(src, ox, oy, alpha = 1, dim = 0) {
      for (let y = src.by0; y <= src.by1; y++) for (let x = src.bx0; x <= src.bx1; x++) {
        const i = (y * src.w + x) * 4; if (!src.d[i + 3]) continue;
        if (alpha < 1 && bay(ox + x, oy + y) >= alpha) continue;
        const k = 1 - dim; this.px(ox + x, oy + y, [src.d[i] * k, src.d[i + 1] * k, src.d[i + 2] * (k + dim * 0.25)]);
      }
    }
    outline(c) {
      const add = [], [X0, Y0_, X1, Y1] = this.box(1);
      for (let y = Y0_; y <= Y1; y++) for (let x = X0; x <= X1; x++)
        if (!this.a(x, y) && (this.a(x - 1, y) || this.a(x + 1, y) || this.a(x, y - 1) || this.a(x, y + 1))) add.push(x, y);
      for (let i = 0; i < add.length; i += 2) this.px(add[i], add[i + 1], c);
    }
    // 整体调色：按亮度把画面往某个颜色拉，k = 强度
    tint(c, k) {
      c = col(c);
      for (let i = 0; i < this.d.length; i += 4) {
        const l = (this.d[i] * 0.3 + this.d[i + 1] * 0.59 + this.d[i + 2] * 0.11) / 255;
        for (let j = 0; j < 3; j++) this.d[i + j] = this.d[i + j] * (1 - k) + c[j] * l * k * 1.6;
      }
    }
    // 乘一个颜色（傍晚偏暖、夜里偏蓝），k = 强度
    grade(c, k) {
      c = col(c);
      for (let i = 0; i < this.d.length; i += 4) for (let j = 0; j < 3; j++) this.d[i + j] = this.d[i + j] * (1 - k) + (this.d[i + j] * c[j] / 255) * k;
    }
    // 右侧阴影：只压暗已经画了的像素（不会溢出轮廓）；x0 起 edge 列用抖动过渡，之后整片压暗
    shadeRight(x0, k = 0.8, edge = 4, y0 = 0) {
      for (let y = y0; y < this.h; y++) for (let x = x0; x < this.w; x++) {
        const i = (y * this.w + x) * 4; if (!this.d[i + 3]) continue;
        if (x < x0 + edge && bay(x, y) >= (x - x0 + 1) / (edge + 1)) continue;
        this.d[i] *= k; this.d[i + 1] *= k; this.d[i + 2] *= k + (1 - k) * 0.3;
      }
    }
    // 赛璐璐阴影：lit(x, y) 为假的像素乘 mul（硬边，不抖动）
    cel(lit, mul) {
      for (let y = this.by0; y <= this.by1; y++) for (let x = this.bx0; x <= this.bx1; x++) {
        const p = (y * this.w + x) * 4; if (!this.d[p + 3] || lit(x, y)) continue;
        this.d[p] *= mul[0]; this.d[p + 1] *= mul[1]; this.d[p + 2] *= mul[2];
      }
    }
    // 本层勾边：自己轮廓上的像素换成 c（头发用发色最深的那档，皮肤用 skinS）
    edge(c) {
      const w = this.w, h = this.h, on = new Uint8Array(w * h), E = (x, y) => x >= 0 && y >= 0 && x < w && y < h && on[y * w + x], [X0, Y0_, X1, Y1] = this.box(1);
      for (let y = Y0_; y <= Y1; y++) for (let x = X0; x <= X1; x++)
        if (this.a(x, y) && (!this.a(x - 1, y) || !this.a(x + 1, y) || !this.a(x, y - 1) || !this.a(x, y + 1))) on[y * w + x] = 1;
      // Pixel Perfect：一个描边像素左右有一个、上下也有一个描边邻居，而它俩夹着的那个斜角在形状外面 → 它是 L 形的拐角，去掉，线变成干净的 1 像素斜线
      for (let y = Y0_; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
        if (!on[y * w + x]) continue;
        for (const [hx, vy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
          if (E(x + hx, y) && E(x, y + vy) && !this.a(x + hx, y + vy) && !E(x - hx, y) && !E(x, y - vy)) { on[y * w + x] = 2; break; }
      }
      for (let y = Y0_; y <= Y1; y++) for (let x = X0; x <= X1; x++) if (on[y * w + x] === 1) this.px(x, y, c);
    }
    // 外轮廓：轮廓外一圈取相邻像素颜色的深一档（k 越小越深），比纯黑描边柔和
    selout(k = 0.42) {
      const add = [], [X0, Y0_, X1, Y1] = this.box(1);
      for (let y = Y0_; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
        if (this.a(x, y)) continue;
        let r = 0, g = 0, bl = 0, n = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.a(x + dx, y + dy)) { const i = ((y + dy) * this.w + x + dx) * 4; r += this.d[i]; g += this.d[i + 1]; bl += this.d[i + 2]; n++; }
        if (n) add.push(x, y, (r / n) * k, (g / n) * k, (bl / n) * (k + 0.06));
      }
      for (let i = 0; i < add.length; i += 5) this.px(add[i], add[i + 1], [add[i + 2], add[i + 3], add[i + 4]]);
    }
    toCanvas(cv) {
      cv.width = this.w; cv.height = this.h;
      cv.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(this.d), this.w, this.h), 0, 0);
    }
  }

  /* ---------- 立绘 112×210 ----------
   * 正脸，中线是第 56 列：x 和 112 - x 互为镜像。头顶 y≈16；眼睛 (44, 65) (68, 65)；嘴 y=82；下巴 y=92；领口 y≈98；肩头 y≈113
   * 左右对称靠画法保证：脸、衣服、头发的对称部分只画左半边再 mirrorHalf()；眼睛、眉毛、腮红用 mirrorPen() 镜像画右边那只。
   *   不对称的东西最后单独画：刘海分缝、马尾、胸袋、光照的阴影和亮面
   * 赛璐璐阴影：光从左上来，阴影是硬边色块（PB.cel），人物身上不铺抖动；头发 4 个色阶；轮廓用本色的深暖色
   */
  const OW = 160, PADX = 24; // 拼好的立绘比设计画布宽，左右各多 24：叉腰、挥手时手肘伸得出去
  const SW = 112, SH = 240, VIS = 210, HX = 56, EY = 65, EXL = 44, EXR = 2 * HX - EXL, MY = 82, CHIN = 92, Y0 = 100;
  const mix = (a, b, t) => { a = col(a); b = col(b); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };
  // 左半边抄到右半边
  function mirrorHalf(L) {
    for (let y = 0; y < L.h; y++) for (let x = HX + 1; x < L.w; x++) { const i = (y * L.w + x) * 4, j = (y * L.w + 2 * HX - x) * 4; for (let k = 0; k < 4; k++) L.d[i + k] = L.d[j + k]; }
    if (L.bx1 >= 0) { const a = L.bx0; L.bx0 = Math.min(a, 2 * HX - Math.min(L.bx1, HX)); L.bx1 = Math.min(L.w - 1, 2 * HX - a); }
  }
  // 镜像画笔：照常调用画图方法，像素落在中线另一侧
  function mirrorPen(b) { const m = Object.create(b); m.px = (x, y, c) => b.px(2 * HX - Math.floor(x), y, c); m.a = (x, y) => b.a(2 * HX - x, y); return m; }
  const EXPR = {
    neutral: { eye: "open", brow: "flat", mouth: "line" },
    smile: { eye: "soft", brow: "up", mouth: "smile" },
    grin: { eye: "happy", brow: "up", mouth: "grin", blush: 1 },
    shy: { eye: "away", brow: "sad", mouth: "small", blush: 2 },
    pout: { eye: "half", brow: "angry", mouth: "pout", blush: 1, puff: 1 },
    angry: { eye: "sharp", brow: "angry", mouth: "shout" },
    sad: { eye: "down", brow: "sad", mouth: "frown" },
    cry: { eye: "tight", brow: "sad", mouth: "wail", tears: 1 },
    surprise: { eye: "wide", brow: "high", mouth: "o" },
    smug: { eye: "half", brow: "up", mouth: "cat" },
  };
  const EXPR_NAMES = { neutral: "普通", smile: "微笑", grin: "大笑", shy: "害羞", pout: "嘟嘴", angry: "生气", sad: "难过", cry: "哭", surprise: "惊讶", smug: "得意" };
  const EYE = { blue: ["navyM", "blue", "blueL"], green: ["greenD", "green", "jade"], amber: ["brownD", "amber", "gold"], violet: ["violetD", "violet", "violetL"], red: ["redD", "red", "rose"], brown: ["brownD", "brown", "brownL"], grey: ["shadow", "grey", "silver"] };
  const HAIR = { black: ["hairB", "hairB2", "hairB3"], brown: ["brownD", "brown", "brownL"], blonde: ["goldD", "gold", "goldL"], pink: ["sakuraD", "sakura", "sakuraL"], silver: ["silverD", "silverM", "silverL"], blue: ["navy", "blueD", "blue"], red: ["redD", "red", "rose"], violet: ["violetD", "violet", "violetL"] };
  // 赛璐璐阴影的乘数：头发、衣服偏紫
  const CEL = { hair: [0.78, 0.74, 0.88], cloth: [0.74, 0.74, 0.88] };

  // 二次贝塞尔：采样成 [x0,y0,x1,y1,...]
  function qb(p0, p1, p2, n = 12) { const out = []; for (let i = 0; i <= n; i++) { const t = i / n, a = (1 - t) * (1 - t), m = 2 * (1 - t) * t, c = t * t; out.push(a * p0[0] + m * p1[0] + c * p2[0], a * p0[1] + m * p1[1] + c * p2[1]); } return out; }
  // 一束头发：沿二次曲线从 (x0,y0) 经控制点到 (x1,y1)，根部宽 w0、尖端宽 w1；p 越大越晚收尖
  function strand(b, x0, y0, cx, cy, x1, y1, w0, w1, c, n = 14, p = 1) {
    const L = [], R = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, a = (1 - t) * (1 - t), m = 2 * (1 - t) * t, cc = t * t;
      const x = a * x0 + m * cx + cc * x1, y = a * y0 + m * cy + cc * y1;
      const dx = 2 * (1 - t) * (cx - x0) + 2 * t * (x1 - cx), dy = 2 * (1 - t) * (cy - y0) + 2 * t * (y1 - cy), len = Math.hypot(dx, dy) || 1;
      const w = (w1 + (w0 - w1) * (1 - t ** p)) / 2;
      L.push(x - (dy / len) * w, y + (dx / len) * w); R.push(x + (dy / len) * w, y - (dx / len) * w);
    }
    const pts = L.slice(); for (let i = R.length - 2; i >= 0; i -= 2) pts.push(R[i], R[i + 1]);
    b.poly(pts, c);
  }
  // 一段肢体：沿二次曲线、按宽度曲线 prof（[[t, 宽], ...]）画；shade = { c, k } 时在背光一侧（光从左上来）压一条暗带，宽 k × 肢体宽
  const LIGHT = [-0.6, -0.8];
  function limb(b, x0, y0, cx, cy, x1, y1, prof, c, shade, n = 12) {
    const W = t => { for (let i = 1; i < prof.length; i++) if (t <= prof[i][0]) { const [ta, wa] = prof[i - 1], [tb, wb] = prof[i]; return wa + (wb - wa) * ((t - ta) / (tb - ta || 1)); } return prof[prof.length - 1][1]; };
    const L = [], R = [], SL = [], SR = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, a = (1 - t) * (1 - t), m = 2 * (1 - t) * t, cc = t * t;
      const x = a * x0 + m * cx + cc * x1, y = a * y0 + m * cy + cc * y1;
      const dx = 2 * (1 - t) * (cx - x0) + 2 * t * (x1 - cx), dy = 2 * (1 - t) * (cy - y0) + 2 * t * (y1 - cy), len = Math.hypot(dx, dy) || 1;
      let nx = -dy / len, ny = dx / len; if (nx * LIGHT[0] + ny * LIGHT[1] > 0) { nx = -nx; ny = -ny; } // n 指向背光的一侧
      const w = W(t) / 2;
      L.push(x - nx * w, y - ny * w); R.push(x + nx * w, y + ny * w);
      if (shade) { SL.push(x + nx * w * (1 - 2 * shade.k), y + ny * w * (1 - 2 * shade.k)); SR.push(x + nx * (w + 1), y + ny * (w + 1)); }
    }
    const pts = L.slice(); for (let i = R.length - 2; i >= 0; i -= 2) pts.push(R[i], R[i + 1]);
    b.poly(pts, c);
    if (shade) { const sp = SL.slice(); for (let i = SR.length - 2; i >= 0; i -= 2) sp.push(SR[i], SR[i + 1]); b.poly(sp, shade.c, 1, (x, y) => b.a(x, y)); }
  }
  // 一层：先画在自己的缓冲里，lit 以外的像素按 mul 压暗（硬边），再用 edgeC 勾本层的边
  function layer(draw, lit, mul, edgeC) { const L = new PB(SW, SH); draw(L); if (lit) L.cel(lit, mul); if (edgeC) L.edge(edgeC); return L; }
  const litEll = (cx, cy, rx, ry) => (x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;

  // 一只眼，按画面左边那只（外眼角朝左）画；右边那只用 mirrorPen 画同一份
  //   gx = 眼珠往左右偏几像素（画面方向已经由调用方换算好），hl = 1 高光在本地左上、-1 在本地右上（镜像后都落在画面左上）
  function eye(b, cx, cy, kind, ec, lash, blink, male, gx, hl) {
    const w = male ? 6 : 7, h = male ? 4.5 : 6;
    if (blink === 2 || kind === "happy" || kind === "tight") {
      if (kind === "happy") { for (const dy of [0, 1]) b.path([cx - w, cy + 2 + dy, cx - 3, cy - 2 + dy, cx + 3, cy - 2 + dy, cx + w, cy + 2 + dy], lash); }
      else if (kind === "tight") { for (const d of [0, 1]) b.path([cx - w + 1, cy - 4 + d, cx + 3, cy + d, cx - w + 1, cy + 4 + d], lash); } // >：尖朝鼻梁
      else { for (const dy of [0, 1]) b.path([cx - w, cy + dy, cx - 3, cy + 3 + dy, cx + 3, cy + 3 + dy, cx + w, cy + dy], lash); b.line(cx - w, cy, cx - w - 2, cy - 2, lash); }
      return;
    }
    const lid = Math.round(cy - h + (kind === "half" ? 5 : kind === "sharp" ? 2 : kind === "soft" ? 1 : 0) + (blink === 1 ? 6 : 0));
    const big = kind === "wide", arc = x => { const k = (x - cx) / w; return lid - Math.round(1.6 * (1 - k * k)); };
    const inEye = (x, y) => y > lid && ((x + 0.5 - cx) / (w + 0.5)) ** 2 + ((y + 0.5 - cy - 0.5) / (h + 1.5)) ** 2 <= 1;
    b.ell(cx, cy + 0.5, w + 0.5, h + 1.5, "white", inEye);
    b.ell(cx, cy + 0.5, w + 0.5, h + 1.5, mix("white", "blueL", 0.55), (x, y) => inEye(x, y) && y <= lid + 1); // 上眼皮在眼白上的影
    const ix = cx + gx, iy = cy + 0.5 + (kind === "down" || kind === "away" ? 1 : 0);
    const irx = big ? 4 : male ? 4.2 : 5, iry = big ? 4.6 : male ? 5.6 : 7;
    b.ell(ix, iy, irx, iry, ec[1], inEye);
    b.ell(ix, iy - iry * 0.5, irx, iry * 0.62, ec[0], inEye);
    b.ell(ix, iy + iry * 0.62, irx * 0.72, iry * 0.34, ec[2], inEye);
    b.ell(ix, iy - 0.5, irx * 0.42, iry * 0.5, "ink", inEye);
    if (lid < iy - 3) { b.rect(Math.round(hl > 0 ? ix - 3 : ix), Math.round(iy - 4), 3, 3, "white"); b.px(hl > 0 ? ix + 2 : ix - 3, iy + 3, "white"); if (big) b.px(hl > 0 ? ix + 1 : ix - 2, iy - 4, "white"); }
    // 上睫毛：两像素粗，外半段再加一像素，外眼角往上撇
    for (let x = cx - w; x <= cx + w; x++) { const y = arc(x); b.px(x, y, lash); b.px(x, y + 1, lash); if (!male && x - cx < -w * 0.2) b.px(x, y - 1, lash); }
    b.line(cx - w, lid, cx - w - 2, lid - 2, lash); b.px(cx - w - 1, lid + 1, lash);
    if (!male) for (let x = cx - w + 1; x < cx + w; x++) b.px(x, arc(x) - (x - cx < -w * 0.2 ? 2 : 1), "lid"); // 眼影：睫毛上面一行
    if (kind === "sharp") b.line(cx + w, lid + 2, cx - w, lid - 1, lash);
    b.line(cx - Math.round(w * 0.3), cy + h + 2, cx - w, cy + h + 1, "lashL"); // 下睫毛：外侧一小段
  }
  // 一边的眉毛（画面左边那条，内端朝右）
  function brow(b, cx, y, kind, c, male) {
    const inner = cx + 5, outer = cx - 6, t = male ? 2 : 1;
    for (let d = 0; d < t; d++) switch (kind) {
      case "up": b.path([inner, y + d, cx, y - 2 + d, outer, y + d], c); break;
      case "sad": b.path([inner, y - 2 + d, cx, y - 1 + d, outer, y + 1 + d], c); break;
      case "angry": b.path([inner, y + 2 + d, cx, y + d, outer, y - 1 + d], c); break;
      case "high": b.path([inner, y - 3 + d, cx, y - 5 + d, outer, y - 3 + d], c); break;
      default: b.path([inner, y + d, cx, y - 1 + d, outer, y + d], c);
    }
  }
  // 嘴：画在自己的图层里，bust 再 mirrorHalf，保证左右一样
  function mouth(b, kind, talk) {
    const x = HX, y = MY, m = "lip", in_ = "red";
    if (talk) kind = { line: "open", smile: "smileOpen", small: "open", frown: "open", pout: "open", cat: "smileOpen", flat: "open" }[kind] || kind;
    switch (kind) {
      case "smile": b.path([x - 3, y - 1, x - 1, y, x, y], m); break;
      case "smileOpen": b.poly([x - 3, y - 1, x + 1, y - 1, x + 1, y + 2, x - 1, y + 2], in_); b.line(x - 3, y - 1, x, y - 1, m); break;
      case "grin": b.poly([x - 5, y - 2, x + 1, y - 2, x + 1, y + 4, x - 2, y + 4], m); b.rect(x - 2, y + 2, 3, 2, "rose"); b.line(x - 4, y - 2, x, y - 2, "white"); break;
      case "open": b.ell(x + 0.5, y + 1, 1.6, 1.8, m); break;
      case "o": b.ell(x + 0.5, y + 1, 2.2, 2.8, m); b.px(x, y + 2, in_); break;
      case "frown": b.path([x - 3, y + 1, x - 1, y, x, y], m); break;
      case "small": b.line(x - 1, y, x, y, m); break;
      case "pout": b.path([x - 2, y, x - 1, y - 1, x, y], m); break;
      case "shout": b.poly([x - 4, y - 2, x + 1, y - 2, x + 1, y + 4, x - 3, y + 4], m); b.line(x - 3, y - 1, x, y - 1, "white"); b.rect(x - 2, y + 2, 3, 2, "rose"); break;
      case "wail": b.poly([x - 4, y - 1, x + 1, y - 1, x + 1, y + 3, x - 2, y + 3], m); b.path([x - 4, y - 1, x - 2, y - 2, x, y - 1], m); break;
      case "cat": b.path([x - 4, y - 1, x - 2, y + 1, x, y - 1], m); break;
      default: b.line(x - 2, y, x, y, m);
    }
  }

  // 身体：从脖子顺下来的斜肩；胳膊另外画（arm）。女生肩窄、男生肩宽。只画左半边，外面再镜像
  // 身体比基准宽 1.3 倍：肩宽约是头宽的 1.3–1.6 倍（以前肩和头一样宽，像大头娃娃）。衣服都按基准宽度画，画的时候用 bodyPen 横向撑开
  const BODY_K = 1.3, shoulderBase = s => (s.male ? 38 : 32), shoulderOf = s => shoulderBase(s) * BODY_K;
  function bodyPen(b, k = BODY_K) {
    const m = Object.create(b), X = x => HX + (x - HX) * k, iX = x => HX + (x - HX) / k, K = f => f && ((x, y) => f(iX(x), y));
    m.poly = (pts, c, tt, keep) => b.poly(pts.map((v, i) => (i % 2 ? v : X(v))), c, tt, K(keep));
    m.rect = (x, y, w, h, c) => b.rect(Math.round(X(x)), y, Math.max(1, Math.round(w * k)), h, c);
    m.ell = (cx, cy, rx, ry, c, keep, tt) => b.ell(X(cx), cy, rx * k, ry, c, K(keep), tt);
    m.line = (x0, y0, x1, y1, c) => b.line(X(x0), y0, X(x1), y1, c);
    m.px = (x, y, c) => b.px(X(x), y, c); m.a = (x, y) => b.a(Math.round(X(x)), y);
    m.dith = (x, y, w, h, c, tt, keep) => b.dith(Math.round(X(x)), y, Math.round(w * k), h, c, tt, K(keep));
    return m;
  }
  // 宽度曲线插值：P = [[t, 值], ...]，段间 smoothstep，拐点是圆的（身体、胳膊的轮廓都用它）
  const pf = (P, t) => { if (t <= P[0][0]) return P[0][1]; for (let i = 1; i < P.length; i++) if (t <= P[i][0]) { const [a, va] = P[i - 1], [b, vb] = P[i], k = (t - a) / (b - a || 1); return va + (vb - va) * k * k * (3 - 2 * k); } return P[P.length - 1][1]; };
  // 身体的半宽（基准坐标，bodyPen 再横向乘 BODY_K），[离肩线多远, 半宽]：女生沙漏（肩 → 胸 → 细腰 → 胯），男生倒三角（宽肩 → 收腰，胯和腰差不多）
  //   对着参考像素立绘量的：女生腰宽约是肩宽的 6 成、胯约 8 成，腰在手肘高度；以前腰是肩的 8 成、从肩到底差不多直，身体像一块砖
  //   衣服的侧边都按 bodyW 走（edgeAt），别写死 x
  const BODY = { f: [[0, 28], [8, 25.2], [20, 26.2], [28, 25.4], [40, 21.2], [50, 19], [62, 17.6], [72, 18.2], [100, 23], [128, 24]], m: [[0, 36], [10, 33], [34, 30.5], [58, 26], [72, 24.6], [100, 25.2], [128, 25.6]] };
  const bodyW = (s, y) => pf(BODY[s.male ? "m" : "f"], y - Y0 - 12), edgeAt = (s, y, d = 0) => HX - bodyW(s, y) - d;
  const WAIST = Y0 + 76; // 腰最细处、腰带的高度（和垂手时的手肘一样高）
  function torso(b, s, c, d) {
    const y0 = Y0 + 12, W = y => bodyW(s, y), pts = [HX + 1, Y0 - 3, ...qb([HX - 9, Y0 - 3], [HX - 13, Y0 + 7], [HX - W(y0), y0], 8)]; // 斜方肌：从脖子先陡后缓地斜下去（凹的弧），不是先平后陡的「衣架肩」
    for (let y = y0 + 4; y < SH; y += 4) pts.push(HX - W(y), y);
    b.poly([...pts, HX - W(SH), SH, HX + 1, SH], c);
    if (!d) return; // 褶：腰侧两道短斜线（布料在腰上收紧）；体积（圆筒、胸）另外按明暗画（formShade）
    for (const dy of [-9, 3]) b.path([HX - W(WAIST + dy) + 1.5, WAIST + dy, HX - W(WAIST + dy + 4) + 5, WAIST + dy + 4], d);
  }
  /* 衣服的体积（画在已经画好的衣服上，乘颜色，所以什么衣服都能用；扣子、绑带、背心会跟着暗下去，像被撑起来）
   *   以前：一个大椭圆分亮暗 + 胸口一块椭圆亮面 → 像钢板；女生的胸只有两道月牙 → 像钢板上两个椭圆
   *   现在的画法：
   *   - 躯干是圆筒：背光的右侧一道一影，宽度跟着身形变；女生在胸的高度变窄（胸往前顶、迎着光），胸下变宽（肋骨往里收），
   *     暗面的边就在胸那里绕出一道弯，胸的体积是从这道弯看出来的
   *   - 胸部明暗：上半迎光提一档亮、中间底色、下半一影（往右下偏）、贴着下沿一道二影，两胸之间一道一影连起来；
   *     位置：上沿和腋下一样高、下沿在心窝上、挂在锁骨中段下、外沿到胳膊下
   *   - 男生：胸肌左上一块亮
   *   s.bust：胸部明暗强度 0–1；没写时按 age 定，未满 18 或没写 age 不画
   */
  const BUST = { cy: Y0 + 31, rx: 14, ry: 9.5, dx: 17 };
  function formShade(L, s, shine) {
    const k = s.male ? 0 : s.bust != null ? s.bust : s.age >= 18 ? 1 : 0, mid = HX + 0.5, tag = new Int8Array(L.w * L.h); // 1 一影、2 二影、-1 亮
    const set = (x, y, v) => { if (!L.a(x, y)) return; const i = y * L.w + x; if (v > 0 ? v > tag[i] : tag[i] === 0) tag[i] = v; };
    const inE = (x, y, ox, oy, a, b) => ((x + 0.5 - ox) / a) ** 2 + ((y + 0.5 - oy) / b) ** 2 <= 1;
    // 圆筒：每行按衣服实际的左右边（披肩、裙摆可能比身体宽）算，右侧外面 f 成压一影
    const F = k ? [[-16, 0.36], [0, 0.32], [12, 0.2], [24, 0.16], [32, 0.4], [46, 0.38], [64, 0.3], [100, 0.24], [128, 0.26]] : [[-16, 0.36], [0, 0.32], [20, 0.26], [44, 0.36], [64, 0.3], [100, 0.26], [128, 0.26]];
    for (let y = Math.max(0, L.by0); y <= L.by1; y++) {
      let xl = -1, xr = -1; for (let x = L.bx0; x <= L.bx1; x++) if (L.a(x, y)) { if (xl < 0) xl = x; xr = x; }
      if (xl < 0) continue;
      const half = Math.max(mid - xl, xr + 1 - mid), f = pf(F, y - Y0 - 12);
      for (let x = Math.ceil(mid + half * (1 - f)); x <= xr; x++) set(x, y, 1);
    }
    if (k) {
      const rx = BUST.rx * k, ry = BUST.ry * k, cy = BUST.cy + (k - 1) * 3;
      for (const side of [-1, 1]) {
        const cx = mid + side * BUST.dx * k;
        for (let y = Math.floor(cy - ry) - 1; y <= cy + ry + 3; y++) for (let x = Math.floor(cx - rx) - 1; x <= cx + rx + 1; x++) {
          const inB = inE(x, y, cx, cy, rx, ry);
          if (inB && !inE(x, y, cx - 2.5, cy - 4.5 * k, rx * 1.02, ry)) set(x, y, 1); // 下半一影
          else if (!inB && y > cy && inE(x, y, cx + 0.4, cy + 2 * k, rx * 0.97, ry)) set(x, y, 2); // 胸下二影
          else if (inB && inE(x, y, cx - rx * 0.28, cy - ry * 0.32, rx * 0.62, ry * 0.56)) set(x, y, -1); // 上半迎光
        }
      }
      for (let y = Math.floor(cy - ry * 0.15); y <= cy + ry; y++) { const w = ((y - (cy - ry * 0.15)) / (ry * 1.15)) * 2.4; for (let x = Math.floor(mid - w); x < mid + w; x++) set(x, y, 1); } // 谷
    } else { const hi = litEll(HX - 22, Y0 + 22, 20, 30); for (let y = L.by0; y <= L.by1; y++) for (let x = L.bx0; x <= L.bx1; x++) if (hi(x, y)) set(x, y, -1); } // 男生：胸肌左上一块亮
    const M = { 1: CEL.cloth, 2: CEL.cloth.map(v => v * 0.8), "-1": [1 + shine * 1.3, 1 + shine * 1.3, 1 + shine] };
    for (let y = L.by0; y <= L.by1; y++) for (let x = L.bx0; x <= L.bx1; x++) { const t = tag[y * L.w + x]; if (!t) continue; const i = (y * L.w + x) * 4; if (t < 0 && L.d[i] + L.d[i + 1] + L.d[i + 2] > 640) continue; const m = M[t]; for (let q = 0; q < 3; q++) L.d[i + q] *= m[q]; } // 白衣服不提亮（会冲成纯白，像贴了两个白椭圆）
  }
  function bow(b, x, y, c, big) { const k = big ? 1.4 : 1; b.poly([x, y, x - 7 * k, y - 4 * k, x - 7 * k, y + 4 * k], c); b.rect(x - 1, y - 1, 2, 3, "white"); } // 左半个，镜像出右半
  /* 服装表：OUTFITS[type] = { draw(b, s, o) 画左半边（会被镜像）, extra(b, s, o) 只在一边的东西, back(b, s, o) 躯干后面的后片（斗篷背后、内衬）, sleeve(o) 袖子 }
   *   o = CAST 里这套衣服的参数：main [深, 中, 浅]、acc 领结色、tie、print……
   *   sleeve 返回 { c 袖子色, d 深色, cuff 袖口色, bell 喇叭袖, frill 喇叭袖里的内衬色, pad 垫肩, roll 卷到肘上（露出小臂；可给卷边色）, bracer [色, 线色] 护腕, glove [色, 暗色] 手套,
   *                 armor 盔甲胳膊：pauldron [色, 亮, 缝, 片数] 肩甲, mail [色, 色] 锁子甲, couter [色, 亮] 护肘, vambrace [色, 亮, 暗] 护臂 }
   *   新题材要新衣服：在游戏的 pixel_art.js 里往 OUTFITS 加一项，不用改 bust()
   */
  // 衣服按部件画（衣服画法：领子、镶边、口袋、下摆各是一块；褶从腋下、腰、领口出发；边缘一道亮线让布料有厚度）
  const rib = (b, s, y0, c, d) => { b.poly([HX + 1, y0, edgeAt(s, y0, 0.4), y0, edgeAt(s, SH, 0.4), SH, HX + 1, SH], c); for (let x = edgeAt(s, y0) + 1.5 / BODY_K; x < HX; x += 2 / BODY_K) b.line(x, y0 + 1, x, SH, d); }; // 罗纹下摆：每 2 像素一道竖条
  const OUTFITS = {
    sailor: { // 水手服：白上衣 + 两道白线的大领 + 领巾蝴蝶结；上衣下摆一道弧，下面露出百褶裙
      draw(b, s, o) { const [D, M] = o.main, A = o.acc, X = HX, y = Y0;
        torso(b, s, "white", "silver");
        const yh = WAIST + 6; b.poly([X + 1, yh + 3, edgeAt(s, yh, 0.5), yh, edgeAt(s, SH, 5), SH, X + 1, SH], D); for (const k of [0.25, 0.55, 0.85]) b.line(X - (X - edgeAt(s, yh)) * k, yh + 4, X - (X - edgeAt(s, SH, 5)) * k, SH, M); // 百褶裙：从腰往下散开
        b.path(qb([edgeAt(s, yh - 2), yh - 2], [X - 12, yh + 3], [X + 1, yh + 2], 6), "silver"); // 上衣下摆
        b.poly([X + 1, y - 2, ...qb([X - 9, y - 2], [X - 13, y + 8], [X - 27, y + 13], 6), X - 30, y + 20, X - 10, y + 15, X, y + 28, X + 1, y + 28], D); // 大领顺着斜肩
        b.path([X - 27, y + 17, X - 10, y + 12, X, y + 23], "white"); b.path([X - 24, y + 13, X - 10, y + 8, X - 4, y + 14], "white");
        b.poly([X - 7, y - 3, X + 1, y - 3, X + 1, y + 10, X, y + 10], o.sk);
        bow(b, X, y + 20, A, true); b.poly([X - 3, y + 22, X - 7, y + 38, X - 2, y + 34], A); },
      sleeve: o => ({ c: "white", d: "silver", cuff: o.main[0] }) },
    blazer: { // 西装外套（制服、职场通用）：外套（两道公主线、腰袋盖、下摆在扣子下面分开）+ 翻领（内沿一道亮）+ 衬衫领 + 蝴蝶结 / 领带
      draw(b, s, o) { const [D, M, L] = o.main, A = o.acc, X = HX, y = Y0;
        torso(b, s, M, D);
        b.path(qb([edgeAt(s, y + 14, -7), y + 14], [edgeAt(s, WAIST, -6), WAIST], [edgeAt(s, SH, -8), SH], 8), D); // 公主线：跟着腰身收
        b.poly([X + 1, WAIST - 4, X - 1, WAIST - 4, X - 9, SH, X + 1, SH], "white"); b.path([X - 1, WAIST - 4, X - 9, SH], D); // 扣子下面前襟分开
        { const yp = WAIST + 12, x0 = edgeAt(s, yp, -2); b.rect(x0, yp, 11, 3, D); b.line(x0, yp - 1, x0 + 10, yp - 1, L); } // 腰袋盖
        b.poly([X - 10, y - 2, X + 1, y - 2, X + 1, y + 42, X, y + 42, X - 5, y + 36], "white");
        b.poly([X - 6, y - 3, X + 1, y - 3, X + 1, y + 6, X, y + 6], o.sk);
        b.poly([X - 10, y - 2, X - 1, y + 7, X - 7, y + 11], "white"); b.path([X - 10, y - 2, X - 1, y + 7, X - 7, y + 11], "silver");
        b.poly([X - 15, y, X - 10, y + 2, X - 1, y + 46, X - 6, y + 50, X - 16, y + 22, X - 12, y + 16], M); b.path([X - 11, y + 3, X - 2, y + 45], L); b.path([X - 16, y + 22, X - 12, y + 16], D); // 翻领 + 内沿亮线 + 驳口
        if (o.tie) b.poly([X - 2, y + 10, X + 1, y + 10, X + 1, y + 39, X, y + 39, X - 4, y + 34], A); else bow(b, X, y + 12, A, false);
        for (const yy of [WAIST - 18, WAIST - 8]) { b.rect(X - 1, yy, 2, 2, "gold"); b.px(X - 1, yy, "goldL"); } },
      extra(b, s, o) { const X = HX, y = Y0; b.rect(X + 12, y + 26, 10, 2, o.main[0]); b.line(X + 12, y + 25, X + 21, y + 25, o.main[2]); }, // 左胸口袋
      sleeve: o => ({ c: o.main[1], d: o.main[0], cuff: "white" }) },
    sweater: { // 针织开衫：V 领一道罗纹边 + 衬衫领 + 扣子 + 罗纹下摆
      draw(b, s, o) { const [D, M, L] = o.main, X = HX, y = Y0;
        torso(b, s, M, D); b.poly([X - 9, y - 2, X + 1, y - 2, X + 1, y + 22, X, y + 22], "white"); b.poly([X - 6, y - 3, X + 1, y - 3, X + 1, y + 9, X, y + 9], o.sk);
        b.path([X - 9, y - 2, X, y + 22], D); b.path([X - 11, y - 1, X - 1, y + 25], L); b.line(X, y + 22, X, SH, D); // V 领罗纹边
        rib(b, s, SH - 16, M, D);
        for (let yy = y + 30; yy < SH - 18; yy += 11) b.px(X - 2, yy, L); },
      sleeve: o => ({ c: o.main[1], d: o.main[0], cuff: o.main[2] }) },
    hoodie: { // 卫衣：绕在脖子后面的帽子、抽绳、袋鼠兜、罗纹下摆
      draw(b, s, o) { const [D, M] = o.main, X = HX, y = Y0;
        torso(b, s, M, D);
        b.ell(X + 0.5, y + 3, 21, 9, M); b.ell(X + 0.5, y + 3, 21, 9, D, (xx, yy) => yy > y + 3 && xx < X - 8);
        b.ell(X + 0.5, y + 1, 13, 6, D); b.poly([X - 7, y - 3, X + 1, y - 3, X + 1, y + 5, X, y + 5], o.sk);
        b.path([X - 4, y + 7, X - 5, y + 20, X - 4, y + 30], "cream"); b.rect(X - 5, y + 30, 2, 3, "silver");
        { const p0 = WAIST - 6, p1 = WAIST + 16, e1 = edgeAt(s, p1, -2); b.poly([X - 12, p0, X + 1, p0, X + 1, p1, e1, p1], D); b.poly([X - 11, p0 + 1, X + 1, p0 + 1, X + 1, p1 - 1, e1 + 1.5, p1 - 1], M); b.path([X - 11, p0 + 1, e1 + 1.5, p1 - 1], D); } // 袋鼠兜
        rib(b, s, SH - 14, M, D); },
      sleeve: o => ({ c: o.main[1], d: o.main[0], cuff: o.main[0] }) },
    gakuran: { // 立领男生制服：立领（上沿一道白衬领）+ 门襟一排金扣（每颗左上一点亮）+ 公主线
      draw(b, s, o) { const [D, M, L] = o.main, X = HX, y = Y0;
        torso(b, s, M, D); b.path(qb([edgeAt(s, y + 14, -8), y + 14], [edgeAt(s, WAIST, -7), WAIST], [edgeAt(s, SH, -9), SH], 8), D);
        b.rect(X - 9, y - 6, 10, 8, D); b.line(X - 9, y - 6, X, y - 6, "white"); b.line(X - 9, y + 1, X, y + 1, L); b.poly([X - 6, y - 5, X + 1, y - 5, X + 1, y + 1, X, y + 1], o.sk); b.line(X, y + 2, X, SH, D);
        for (let yy = y + 10; yy < SH; yy += 15) { b.rect(X - 1, yy, 2, 3, "gold"); b.px(X - 1, yy, "goldL"); } },
      extra(b, s, o) { const X = HX, y = Y0; b.line(X + 13, y + 28, X + 24, y + 28, o.main[0]); b.line(X + 13, y + 27, X + 24, y + 27, o.main[2]); }, // 左胸口袋
      sleeve: o => ({ c: o.main[1], d: o.main[0], cuff: o.main[0] }) },
    shirt: { // 圆领 T 恤（领口一道罗纹）+ 胸前印花 + 下摆缝线
      draw(b, s, o) { const [D, M, L] = o.main, X = HX, y = Y0;
        torso(b, s, M, D); b.ell(X + 0.5, y - 1, 10, 6, o.sk, (xx, yy) => yy >= y - 3);
        for (const d of [0, 1]) b.path(qb([X - 11, y - 3 + d], [X - 5, y + 8 + d], [X, y + 7 + d], 6), d ? D : L);
        b.path([X - 11, WAIST - 4, X - 15, WAIST + 8], D); b.line(edgeAt(s, SH - 5, -0.5), SH - 5, X, SH - 5, D); },
      extra(b, s, o) { const X = HX, y = Y0; if (o.print) { b.path([X + 9, y + 20, X + 20, y + 20, X + 20, y + 30, X + 15, y + 32, X + 9, y + 30, X + 9, y + 20], o.print); b.line(X + 9, y + 22, X + 20, y + 22, o.print); } },
      sleeve: o => ({ c: o.main[1], d: o.main[0], cuff: null }) },
    // ---- 《余量》的衣服 ----
    shift: { // 工作服（值班长、操作员同款）：尖角翻领夹克，拉链门襟，肩育克，两个带盖胸袋，下摆收口；下面是工装裤。胸口的剂量计和工牌在 extra
      draw(b, s, o) { const [D, M, L] = o.main, X = HX, y = Y0, yh = WAIST + 8, dk = mix(M, D, 0.55);
        torso(b, s, M, D);
        b.poly([X + 1, yh, edgeAt(s, yh, 0.4), yh, edgeAt(s, SH, 0.6), SH, X + 1, SH], o.pants || "ptD"); b.line(X, yh, X, yh + 22, "ink"); b.path([edgeAt(s, yh + 2) + 3, yh + 2, edgeAt(s, yh + 14) + 7, yh + 13], "ink"); // 工装裤：门襟、斜插袋
        b.poly([X + 1, yh - 7, edgeAt(s, yh - 7, 0.3), yh - 7, edgeAt(s, yh, 0.5), yh, X + 1, yh], dk); b.line(edgeAt(s, yh - 7), yh - 7, X, yh - 7, L); b.rect(edgeAt(s, yh - 5) + 2, yh - 6, 4, 4, D); // 下摆收口 + 侧边调节襻
        b.path(qb([X - 12, y + 3], [X - 21, y + 8], [edgeAt(s, y + 15) + 1, y + 15], 6), D); // 肩育克的缝
        b.line(X, y + 4, X, yh - 7, D); b.line(X - 3, y + 6, X - 3, yh - 7, dk); // 拉链 + 门襟边
        { const px = X - 21, py = y + 20; b.path([px, py, px, py + 15, px + 13, py + 15, px + 13, py], D); b.rect(px - 1, py - 2, 15, 6, M); b.line(px - 1, py + 4, px + 13, py + 4, D); b.line(px - 1, py - 2, px + 13, py - 2, L); b.rect(px + 5, py + 1, 3, 2, D); } // 胸袋 + 袋盖 + 扣
        b.poly([X - 6, y - 3, X + 1, y - 3, X + 1, y + 4, X, y + 4], o.sk); // 领口
        b.poly([X - 8, y - 6, X - 16, y - 1, X - 10, y + 12, X - 1, y + 4, X - 2, y - 1], M); b.path([X - 16, y - 1, X - 10, y + 12, X - 1, y + 4], D); b.path([X - 8, y - 6, X - 15, y - 1], L); // 尖角翻领：外沿一道亮、下沿一道暗
      },
      extra(b, s, o) { const X = HX, y = Y0, bx = X - 20;
        b.rect(X + 11, y + 8, 2, 13, "silverM"); b.rect(X + 11, y + 8, 2, 2, "ink"); b.px(X + 11, y + 12, "white"); b.line(X + 13, y + 9, X + 13, y + 18, "silverD"); // 笔式剂量计：插在左胸袋（画面右边）里，露出上半截和笔夹
        b.rect(bx, y + 22, 10, 13, "cream"); b.rect(bx, y + 22, 10, 3, "rd1"); b.rect(bx + 1, y + 26, 4, 5, "gbL"); for (const yy of [y + 27, y + 29, y + 31]) b.line(bx + 6, yy, bx + 8, yy, "shadow"); b.line(bx + 1, y + 33, bx + 8, y + 33, "shadow"); b.rect(bx + 4, y + 20, 2, 3, "silverD"); // 工牌：夹在右胸袋盖上
      },
      sleeve: o => ({ c: o.main[1], d: o.main[0], cuff: o.main[0], roll: o.roll ? o.main[2] : 0 }) },
    coat: { // 白大褂（敞着）+ 深色高领毛衣：翻领带缺口、敞开的前襟露出毛衣、下面两个贴袋；左胸口袋插两支笔在 extra
      draw(b, s, o) { const [D, M, L] = o.main, [KD, KM, KL] = o.inner || ["swD", "swM", "swL"], X = HX, y = Y0;
        torso(b, s, M, D);
        b.poly([X + 1, y - 3, X - 8, y - 3, X - 9, y + 8, X - 8, y + 34, X - 11, SH, X + 1, SH], KM); // 前襟敞开处的毛衣
        b.poly([X - 8, y - 11, X + 1, y - 11, X + 1, y + 3, X - 9, y + 3], KM); for (let xx = X - 7; xx < X; xx += 2) b.line(xx, y - 10, xx, y - 4, KD); b.line(X - 9, y - 3, X, y - 3, KL); b.line(X - 9, y - 2, X, y - 2, KD); // 高领：竖罗纹 + 翻折一道
        b.path([X - 8, y + 34, X - 11, SH], D); b.path([X - 9, y + 35, X - 12, SH], L); // 前襟的边：一道暗、外面一道亮（布的厚度）
        const lap = [X - 9, y - 5, X - 17, y, X - 19, y + 6, X - 16, y + 8, X - 21, y + 12, X - 9, y + 35];
        b.poly(lap, M); b.path(lap, D); b.path([X - 10, y + 1, X - 10, y + 32], L); // 翻领 + 驳头：缺口在锁骨下，里沿翻折处一道亮
        { const yp = WAIST + 14, x0 = edgeAt(s, yp, -1); b.path([x0, yp, x0, yp + 14, x0 + 7, yp + 14, x0 + 7, yp], D); b.line(x0, yp + 1, x0 + 7, yp + 1, L); } // 下面的贴袋：在敞开的前襟外侧
      },
      extra(b, s, o) { const X = HX, y = Y0, [D] = o.main, px = X + 10, py = y + 24;
        b.rect(px + 2, py - 8, 2, 11, "ck1"); b.rect(px + 2, py - 8, 2, 2, "ink"); b.line(px + 4, py - 7, px + 4, py - 2, "silverM"); // 蓝笔
        b.rect(px + 6, py - 6, 2, 9, "ink"); b.px(px + 6, py - 6, "rd1"); b.line(px + 8, py - 5, px + 8, py - 1, "silverM"); // 黑笔
        b.path([px, py, px, py + 11, px + 11, py + 11, px + 11, py], D); b.line(px, py, px + 11, py, D); // 胸袋
      },
      sleeve: o => ({ c: o.main[1], d: o.main[0], cuff: o.main[2] }) },
    suit: { // 白色连体防护服：兜帽不戴、堆在脖子后面一圈；插肩缝；拉链门襟的遮片；腰间松紧收出一排细褶。胸前的剂量计、胶片剂量牌在 extra
      draw(b, s, o) { const [D, M, L] = o.main, X = HX, y = Y0;
        torso(b, s, M, D);
        b.path(qb([X - 13, y + 7], [X - 20, y + 14], [edgeAt(s, y + 24) + 1, y + 24], 6), D); // 插肩缝
        b.path([edgeAt(s, y + 30) + 2, y + 30, X - 14, y + 52], D); // 腋下往腰斜的一道大褶
        b.rect(X - 4, y + 9, 5, SH - y - 9, M); b.line(X - 4, y + 9, X - 4, SH, D); b.line(X - 3, y + 10, X - 3, SH, L); // 门襟遮片
        for (let x = edgeAt(s, WAIST) + 2; x < X - 5; x += 3) b.line(x, WAIST - 3, x, WAIST + 3, D); // 腰间松紧的细褶
        b.ell(X + 0.5, y + 1, 21, 8, M); b.ell(X + 0.5, y + 1, 21, 8, D, (xx, yy) => yy > y + 3 && xx < X - 10); b.path(qb([X - 20, y + 2], [X - 12, y + 9], [X, y + 9], 6), D); // 兜帽堆在领口一圈
        b.ell(X + 0.5, y - 1, 12, 5, D); b.poly([X - 7, y - 3, X + 1, y - 3, X + 1, y + 4, X, y + 4], o.sk);
      },
      extra(b, s, o) { const X = HX, y = Y0, bx = X - 19;
        b.rect(X + 11, y + 13, 2, 14, "silverM"); b.rect(X + 11, y + 13, 2, 2, "ink"); b.px(X + 11, y + 17, "white"); b.line(X + 13, y + 14, X + 13, y + 22, "silverD"); // 笔式剂量计
        b.rect(bx, y + 16, 9, 12, "am3"); b.rect(bx + 2, y + 19, 5, 6, "shadow"); b.px(bx + 2, y + 19, "dusk"); b.rect(bx + 3, y + 14, 3, 3, "silverD"); // 胶片剂量牌：黄夹子、中间一块深色窗
      },
      sleeve: o => ({ c: o.main[1], d: o.main[0], cuff: o.main[2], glove: o.glove }) },
  };
  // 角色的某套衣服：合上默认值，带上肤色
  function outfitOf(s, name) {
    const o = Object.assign({ main: ["navy", "navyM", "blueD"], acc: "red" }, (s.outfits || {})[name] || {});
    o.sk = s.skin || "skin"; o.def = OUTFITS[o.type || name] || OUTFITS.shirt; return o;
  }

  // 头发的 4 个色阶：D 最深（线）、MD 后发和阴影、M 本色、LM 亮面、L 最亮
  const ramp = H => ({ D: H[0], MD: mix(H[0], H[1], 0.5), M: H[1], LM: mix(H[1], H[2], 0.6), L: H[2] });
  // 双马尾的发尾（左边那根，镜像出右边）
  function tail(b, x, y, len, R) { strand(b, x, y, x - 13, y + len * 0.42, x - 4, y + len, 19, 2, R.M, 16, 1.6); strand(b, x - 2, y + 10, x - 10, y + len * 0.45, x - 4, y + len - 10, 2.4, 0.6, R.D); }
  // 后发的对称部分（左半边）
  function hairBack(b, s, R) {
    if (s.hair === "buzz") { b.ell(HX + 0.5, 52, 28, 22, R.MD, (x, y) => y < 62); return; } // 寸头：后脑收在头骨里面（后发这层会像钟摆一样晃，大了会从头顶露出来）
    if (s.hair === "lowtie") { // 低扎：头发贴着头往后梳、在后颈扎住；后面那层收在耳朵上下，脖子两边只露出往下垂的一截
      b.ell(HX + 0.5, 50, 31, 31, R.MD, (x, y) => y < 74);
      strand(b, HX - 15, 80, HX - 17, 96, HX - 12, 116, 9, 7, R.MD); strand(b, HX - 15, 88, HX - 16, 100, HX - 13, 113, 1.4, 0.6, R.D);
      return;
    }
    b.ell(HX + 0.5, 54, 33, 34, R.MD, (x, y) => y < 90); // 头后面那一层：最暗
    switch (s.hair) {
      case "long":
        strand(b, HX - 24, 50, HX - 40, 110, HX - 30, 174, 22, 6, R.MD); b.rect(HX - 30, 70, 31, 100, R.MD);
        for (const dx of [-27, -19]) strand(b, HX + dx, 62, HX + dx * 1.3, 112, HX + dx * 1.08, 168, 2.2, 0.6, R.D);
        break;
      case "bob": strand(b, HX - 26, 50, HX - 36, 80, HX - 26, 98, 18, 6, R.MD); break;
      case "twintail": tail(b, 19, 34, 130, R); break;
    }
  }
  // 后发里只在一边的：马尾、侧马尾
  function hairBackExtra(b, s, R) {
    if (s.hair === "ponytail" && s.tail === "short") { // 短马尾：扎在后脑偏下，从右耳后面支出来、垂到脖子
      strand(b, 82, 46, 103, 58, 99, 100, 19, 3, R.M, 16, 1.3); strand(b, 92, 58, 103, 72, 99, 94, 2.2, 0.6, R.D); strand(b, 90, 70, 98, 84, 93, 98, 1.6, 0.5, R.D);
    } else if (s.hair === "ponytail") { strand(b, 78, 22, 112, 64, 92, 138, 26, 3, R.M, 16, 1.6); strand(b, 96, 70, 110, 104, 104, 130, 10, 1, R.M); strand(b, 86, 36, 106, 76, 95, 124, 2.4, 0.6, R.D); }
    if (s.hair === "sidetail") strand(b, 90, 38, 106, 80, 94, 128, 16, 3, R.M);
  }
  // 前发的对称部分（左半边）：头顶、侧发、齐刘海
  function hairFront(b, s, R) {
    const male = !!s.male, style = s.hair;
    if (style === "buzz") { // 寸头：贴着头骨薄薄一层；发际线两边微微后退，鬓角短到耳朵上沿
      const HL = [[0, 32], [9, 32.5], [15, 35.5], [20, 36], [23.5, 42], [26, 55], [31, 58]];
      b.ell(HX + 0.5, 46, 29.5, 28, R.M, (x, y) => y < pf(HL, Math.abs(x + 0.5 - HX - 0.5)));
      for (const [x0, y0, x1, y1] of [[HX - 6, 24, HX - 9, 31], [HX - 14, 26, HX - 18, 33], [HX - 21, 31, HX - 25, 40], [HX - 26, 40, HX - 27, 50]]) strand(b, x0, y0, (x0 + x1) / 2 - 1, (y0 + y1) / 2, x1, y1, 1.4, 0.6, R.MD, 6); // 几道短发茬的走向
      return;
    }
    b.ell(HX + 0.5, 44, male ? 31 : 34, male ? 29 : 31, R.M, (x, y) => y < 46); // 头顶：比头骨大一圈，显得蓬松
    const sideLen = s.sideLen || (style === "short" ? (male ? 66 : 74) : style === "bob" ? 94 : 104);
    strand(b, HX - 27, 42, HX - 32, 70, HX - 25, sideLen, s.sideW || 11, 2, R.M, 14, 1.5); // 侧发：盖住脸的边（sideW 细 = 头发往后梳、只垂下几缕）
    if (s.bangs === "blunt") { b.rect(HX - 30, 38, 31, 16, R.M); for (const dx of [-20, -8]) strand(b, HX + dx, 40, HX + dx, 47, HX + dx + 1, 53, 2.2, 0.8, R.D); }
  }
  // 前发里不对称的：分缝的刘海、亮面、呆毛
  function hairFrontExtra(b, s, R) {
    const male = !!s.male, rx = male ? 31 : 34, ry = male ? 29 : 31;
    if (s.bangs !== "blunt" && s.hair !== "buzz") {
      // 每束 [尖的 x 偏移, 尖的 y, 根部宽, 往外扫]；分缝偏左，长的那束垂在两眼之间；角色写了 tips 就用角色自己的
      const tips = s.tips || (male ? [[-29, 52, 11, -3], [-19, 58, 13, -3], [-8, 52, 11, -1], [3, 59, 13, 2], [14, 53, 12, 3], [24, 58, 12, 3], [30, 52, 9, 2]]
        : [[-29, 60, 11, -3], [-20, 56, 13, -3], [-11, 61, 13, -2], [-3, 54, 9, 0], [5, 62, 14, 2], [15, 56, 12, 3], [24, 61, 12, 3], [30, 56, 9, 2]]);
      for (const [dx, ty, w, sw] of tips) strand(b, HX - 6 + (dx + 6) * 0.4, 24, HX + dx * 0.85 + sw * 2, 44, HX + dx + sw, ty, w, 1, R.M, 16, 2.2);
      for (let i = 0; i + 1 < tips.length; i++) { // 两束之间一道深色线：中间粗、两头细
        const a = tips[i], c = tips[i + 1], mx = (a[0] + a[3] + c[0] + c[3]) / 2, my = Math.min(a[1], c[1]) - 3;
        strand(b, HX + mx * 0.75, 36, HX + mx * 0.95, (40 + my) / 2, HX + mx, my, 1.2, 2.2, R.D, 10);
      }
    }
    // 亮面：头顶偏左一整块浅色，下沿顺着发束成锯齿；最靠左上的地方再亮一档
    const ZIG = [0, 1, 3, 4, 3, 1];
    for (let x = HX - rx + 5; x <= HX + rx * 0.62; x++) {
      const k = (x + 0.5 - HX) / rx, ye = 44 - ry * Math.sqrt(Math.max(0, 1 - k * k)), y0 = Math.round(ye + 4), y1 = Math.round(ye + 8 + ZIG[x % 6] - Math.max(0, k) * 4);
      for (let y = y0; y <= y1; y++) if (b.a(x, y)) b.px(x, y, k < -0.25 && y < y0 + 2 ? R.L : R.LM);
    }
    if (s.ahoge) strand(b, HX + 2, 16, HX + 10, 4, HX + 14, 10, 4, 1, R.M);
  }
  function hairAcc(b, s) {
    const style = s.hair, c = s.ribbon || "red", P = [b, mirrorPen(b)];
    if (style === "twintail") for (const p of P) { bow(p, 20, 33, c); mirrorBow(p, 20, 33, c); }
    if (style === "ponytail" && s.tail !== "short") { bow(b, 82, 26, c); mirrorBow(b, 82, 26, c); }
    if (style === "sidetail") { bow(b, 90, 38, c); mirrorBow(b, 90, 38, c); }
    if (s.pin) { b.rect(31, 40, 8, 2, s.pin); b.rect(33, 38, 2, 6, s.pin); }
    if (s.headband) b.path(qb([HX - 30, 38], [HX, 14], [HX + 30, 38], 16), s.headband);
    if (s.hat === "witch") { // 巫师帽：宽帽檐 + 往右折的尖顶 + 帽带；画在头这一层，跟着头动
      const [D, M, L] = s.hatC || ["violetD", "violet", "violetL"];
      // 帽身要把整个头顶包进去：底宽 ≈ 头连头发的宽度（以前只有一半宽，头顶从帽身两边冒出来，像帽子顶在头上）；帽檐压在发际线上，刘海和侧发从帽檐下面出来
      const yb = 36, hat = layer(Hb => {
        strand(Hb, HX + 0.5, yb - 1, HX + 2, yb - 22, HX + 24, 2, 66, 3, M, 18, 1.4); // 帽身：往右折的尖顶
        Hb.ell(HX + 0.5, yb, 47, 7, M); Hb.ell(HX + 0.5, yb, 47, 7, D, (x, y) => y >= yb + 1); // 帽檐：下半是檐底，暗
        strand(Hb, HX - 29, yb - 3, HX + 0.5, yb - 5, HX + 30, yb - 3, 5, 5, s.hatBand || "gold", 8); Hb.rect(HX - 2, yb - 7, 5, 5, s.hatGem || "red"); // 帽带 + 宝石
      }, litEll(HX - 14, 14, 44, 30), CEL.hair, mix(D, "ink", 0.45));
      for (let y = 0; y < yb - 1; y++) for (let x = 0; x < b.w; x++) if (!hat.a(x, y)) b.d[(y * b.w + x) * 4 + 3] = 0; // 帽檐以上只剩帽子：头顶的头发都在帽身里面
      b.blit(hat, 0, 0);
    }
  }
  // 整个蝴蝶结 = 左半个 + 以结为中心镜像的右半个
  function mirrorBow(b, x, y, c) { b.poly([x + 1, y, x + 8, y - 4, x + 8, y + 4], c); b.rect(x + 1, y - 1, 1, 3, "white"); }

  /* ---------- 立绘分层：后发、身体、头各自缓存，胳膊每帧现画，compose() 按时间拼起来 ---------- */
  function faceOf(s) { // 脸型（不随表情变），脖子投影和腮红都要用
    const k = "face:" + s.id; if (layersOf.cache[k]) return layersOf.cache[k];
    const S = s.skin || "skin", SD = skinShade(S), male = !!s.male;
    const F = Object.assign({ w: male ? 26 : 24, jaw: male ? 6 : 8, jy: 85, cheek: -1, cx: 14, cy: 91, chin: CHIN + (male ? 1 : 0) }, FACES[s.face]), fw = F.w, chin = F.chin, jaw = F.jaw;
    const face = new PB(SW, SH);
    face.poly([HX + 1, 20, ...qb([HX, 20], [HX - fw, 20], [HX - fw, 46]), ...qb([HX - fw, 46], [HX - fw + F.cheek, 72], [HX - fw + jaw, F.jy]).slice(2), ...qb([HX - fw + jaw, F.jy], [HX - fw + F.cx, F.cy], [HX, chin]).slice(2), HX + 1, chin], S);
    face.ell(HX - fw + 1, 65, 2.6, 5, S); face.line(HX - fw, 63, HX - fw, 67, SD); // 耳朵（带耳窝）
    if (s.ears === "elf") { face.poly([HX - fw + 2, 58, HX - fw - 16, 47, HX - fw - 1, 69], S); face.line(HX - fw - 12, 50, HX - fw, 62, SD); } // 精灵的尖耳朵：尖要伸出侧发
    mirrorHalf(face); face.edge(mix(SD, "brownD", 0.55)); face.fw = fw;
    return (layersOf.cache[k] = face);
  }
  const skinShade = S => ({ skinL: "skin", skin: "skinD", skinD: "wood", skinT: "skinS" }[S] || "skinD");
  // 脸型（角色写 face）：w 半宽、jaw 下颌角往里收多少、jy 下颌角高度、cheek 脸颊外鼓（负 = 往外）、cx cy 下巴弧的控制点（cx 越大下巴越平越宽）、chin 下巴尖
  const FACES = {
    square: { w: 27, jaw: 4, jy: 88, cheek: -1, cx: 20, cy: 94, chin: 94 }, // 方脸：下颌角靠下、下巴平
    round: { w: 25, jaw: 9, jy: 84, cheek: -2.5, cx: 12, cy: 90, chin: 91 }, // 圆脸：脸颊鼓、下巴短
    long: { w: 23, jaw: 8, jy: 89, cheek: 0, cx: 13, cy: 95, chin: 96 },    // 细长脸：窄、下巴长
  };
  // 脸上的纹（角色写 marks）：brow 眉间两道竖纹、fold 法令纹、under 眼袋一道细线（年纪）、bags 眼下的青（熬夜）
  function faceMarks(b, mb, s, S, SD, male) {
    const m = s.marks || {}, wr = mix(S, SD, 0.75), ey = EY + (male ? 6 : 8);
    for (const p of [b, mb]) {
      if (m.brow) p.line(HX - 2, EY - 13, HX - 2, EY - 9, SD);
      if (m.fold) p.path([HX - 6, 77, HX - 8, 80, HX - 8, 83], wr);
      if (m.under) p.path([EXL - 4, ey + 1, EXL - 1, ey + 2, EXL + 3, ey + 1], wr);
      if (m.bags) { const c = mix(S, "violetD", 0.22); p.path([EXL - 5, ey, EXL - 1, ey + 1, EXL + 4, ey], c); p.path([EXL - 3, ey + 1, EXL + 2, ey + 1], mix(S, "violetD", 0.12)); }
    }
  }
  // layersOf(角色, 表情, { blink, talk, outfit }) → { back 后发, body 脖子 + 衣服, head 脸 + 五官 + 前发 }
  function layersOf(s, ex, o = {}) {
    const blink = o.blink || 0, talk = o.talk ? 1 : 0, outfitName = o.outfit || Object.keys(s.outfits || { shirt: 1 })[0];
    const R = ramp(HAIR[s.hairC] || s.hairC || HAIR.black), hairLine = mix(R.D, "ink", 0.45), face = faceOf(s), male = !!s.male;
    const S = s.skin || "skin", SD = skinShade(S), line = mix(SD, "brownD", 0.55), fw = face.fw;
    const kb = "back:" + s.id, ko = "body:" + s.id + ":" + outfitName, kh = ["head", s.id, ex, blink, talk].join(":");
    if (!layersOf.cache[kb]) layersOf.cache[kb] = layer(L => { hairBack(L, s, R); mirrorHalf(L); hairBackExtra(L, s, R); }, LIT, CEL.hair, hairLine);
    if (!layersOf.cache[ko]) {
      const of = outfitOf(s, outfitName), body = new PB(SW, SH), nw = male ? 8 : 6;
      // 层序：衣服后片 → 脖子（下巴在上面投一块硬边影）→ 衣服躯干
      if (of.def.back) body.blit(layer(L => { const B = bodyPen(L); of.def.back(B, s, of); mirrorHalf(L); }, LIT_BODY, CEL.cloth, mix(of.main[0], "outline", 0.6)), 0, 0); // 后片：在躯干后面
      body.blit(layer(L => { L.rect(HX - nw, 84, nw * 2 + 1, 22, S); for (let y = 84; y < 106; y++) for (let x = 0; x < SW; x++) if (L.a(x, y) && (face.a(x, y - 5) || face.a(x, y - 3))) L.px(x, y, SD); }), 0, 0);
      const cloth = layer(L => { const B = bodyPen(L); of.def.draw(B, s, of); mirrorHalf(L); if (of.def.extra) of.def.extra(B, s, of); }, null, null, null);
      formShade(cloth, s, of.def.shine == null ? 0.07 : of.def.shine); cloth.edge(mix(of.main[0], "outline", 0.6)); // 衣服的体积：躯干是圆筒、女生的胸是两个球
      body.blit(cloth, 0, 0);
      layersOf.cache[ko] = body;
    }
    if (!layersOf.cache[kh]) {
      const b = new PB(SW, SH), mb = mirrorPen(b), e = Object.assign({}, EXPR[ex] || EXPR.neutral, (s.expr || {})[ex]);
      const ec = EYE[s.eyeC] || s.eyeC || EYE.brown, lash = male ? R.D : "ink";
      b.blit(face, 0, 0);
      // 五官：眼睛、眉毛、腮红、眼泪都是画左边那份，再用镜像画笔画右边
      const g = e.eye === "away" ? -2 : 0; // 害羞时两只眼都往画面左边看
      eye(b, EXL, EY, e.eye, ec, lash, blink, male, g, 1); eye(mb, EXL, EY, e.eye, ec, lash, blink, male, -g, -1);
      const ml = new PB(SW, SH); mouth(ml, e.mouth, talk); mirrorHalf(ml); b.blit(ml, 0, 0);
      b.px(HX, 74, SD); b.px(HX, 75, SD); // 鼻子：中线上两个像素
      const bl = mix(S, "blush", e.blush ? 0.85 : 0.5);
      for (const p of [b, mb]) {
        if (!male || e.blush) p.ell(EXL - 3, 75, 4.5, 2, bl, (x, y) => face.a(x, y));
        if (e.blush > 1) for (const x of [EXL - 6, EXL - 3, EXL]) p.line(x, 77, x + 1, 74, "blushD");
        if (e.tears) { const x = EXL - 4; p.line(x, 72, x - 1, 82, "blueL"); p.line(x + 1, 72, x, 80, "white"); p.rect(x - 2, 83, 2, 2, "blueL"); }
      }
      if (e.puff) b.path([HX + fw - 5, 74, HX + fw - 2, 77, HX + fw - 4, 80], line);
      // 前发：先在额头投 3 像素的硬边影，再盖上去
      const front = layer(L => { hairFront(L, s, R); mirrorHalf(L); hairFrontExtra(L, s, R); }, litEll(HX - 12, 26, 38, 30), CEL.hair, hairLine);
      const deep = s.hair !== "buzz"; // 寸头没有刘海，额头上只留 1 像素影
      for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) if (face.a(x, y) && !front.a(x, y) && (front.a(x, y - 1) || (deep && (front.a(x, y - 2) || front.a(x, y - 3))))) b.px(x, y, SD);
      b.blit(front, 0, 0);
      faceMarks(b, mb, s, S, SD, male);
      brow(b, EXL, EY - 10, e.brow, R.D, male || s.thickBrow); brow(mb, EXL, EY - 10, e.brow, R.D, male || s.thickBrow); // 眉毛画在刘海上面；thickBrow 女生也画两像素粗
      if (s.acc === "glasses") {
        const gc = mix("ink", "shadow", 0.5), x = EXL;
        for (const p of [b, mb]) {
          p.path([x - 8, EY - 8, x + 8, EY - 8, x + 9, EY - 7, x + 9, EY + 7, x + 8, EY + 8, x - 8, EY + 8, x - 9, EY + 7, x - 9, EY - 7, x - 8, EY - 8], gc);
          p.line(x - 9, EY - 6, HX - fw + 1, EY - 5, gc); p.line(x + 10, EY - 5, HX, EY - 5, gc); // 镜腿、鼻梁
        }
        for (const cx of [EXL, EXR]) { b.line(cx - 7, EY + 6, cx - 4, EY + 3, "white"); b.line(cx - 5, EY + 7, cx - 3, EY + 5, "white"); } // 反光：两边都在左下
      }
      hairAcc(b, s);
      if (s.acc === "earrings") for (const p of [b, mb]) p.px(HX - fw + 1, 70, "gold");
      const hb = new PB(SW, CHIN + 20); hb.d.set(b.d.subarray(0, hb.d.length)); hb.touch(); layersOf.cache[kh] = hb; // 头只留上面这一截：转图要放大 4 倍，省内存
    }
    return { back: layersOf.cache[kb], body: layersOf.cache[ko], head: layersOf.cache[kh], outfit: outfitName };
  }
  layersOf.cache = {};
  const LIT = litEll(HX - 10, 30, 40, 70), LIT_BODY = litEll(HX - 12, Y0 - 10, 46, 110);

  /* ---------- 姿势：胳膊 = 大臂 + 小臂 + 手；每个姿势直接定手肘和手腕在哪（像画师摆姿势），换姿势时两个点一起插值 ----------
   * POSES[名字] = { l: 画面左边那只胳膊, r: 右边那只（"mirror" = 照左边镜像）, item: 1 = 两手中间拿着 item / "r" = 右手拿着 }
   *   每只胳膊 { e: [往外, 往下] 手肘相对肩关节的位置, w: [x, y] 手腕的画面坐标（或 t => [x, y]，按秒数算，会动）, t: 拇指朝 in / out / up / down（不写按手型猜）, back: 1 手背朝前, hd: [dx, dy] 手腕折过来后手指的方向（不写就顺着小臂）,
   *             h: 手型 fist 拳 / palm 张开 / point 指 / relax 垂着（正面看手的侧面）/ flat 手背朝前贴在身上 / hide 不画, front: 1 = 画在脸前面 }
   *   手放在胸前时小臂是朝镜头伸的，画面上会变短：手肘写在腰边就行，别让它往外撑
   *   对话框盖住立绘 y 145–202，要让人看见的手势，手放在 y 145 以上；没写的那只胳膊按待机摆（左手垂着、右手搭在腰前）
   */
  const POSES = {
    rest: {}, // 左手垂着、右手手背朝前搭在腰前（见 arms 的 restOf）
    hip: { l: { e: [16, 58], w: [HX - 30, Y0 + 84], h: "fist", t: "up" }, r: "mirror" },                                     // 叉腰：手在框后面，靠手肘往外撑看出来
    chest: { r: { e: [4, 58], w: [HX + 14, Y0 + 44], h: "flat", t: "up" } },                                       // 手按胸口：手背朝前、四指并拢，拇指在上
    mouth: { r: { e: [8, 38], w: [HX + 13, CHIN - 7], hd: [-1, -0.1], h: "flat", front: 1, t: "down" } },         // 捂嘴：手腕在下巴右边，手横过来、四指并拢盖住嘴，手背朝前，拇指在下面
    think: { r: { e: [0, 36], w: [HX + 8, CHIN + 18], h: "fist", front: 1, t: "up" }, l: { e: [3, 58], w: [HX + 20, Y0 + 76], h: "relax" } }, // 托腮：另一只手托着手肘
    wave: { r: { e: [22, 14], w: t => [HX + 46 + Math.round(Math.sin(t * 9) * 5), Y0 - 30], h: "palm" } },          // 挥手
    point: { r: { e: [20, 22], w: [HX + 58, Y0 + 4], h: "point" } },                                               // 指着
    cheer: { l: { e: [6, 58], w: t => [HX - 17, Y0 + 44 - Math.round(Math.abs(Math.sin(t * 5)) * 3)], h: "fist" }, r: "mirror" }, // 握拳加油
    cross: { l: { e: [4, 54], w: [HX + 26, Y0 + 42], h: "flat" }, r: { e: [4, 50], w: [HX - 26, Y0 + 36], h: "flat" } }, // 抱臂：手搭在另一只胳膊上 // 抱臂
    hold: { l: { e: [3, 56], w: [HX - 21, Y0 + 36], h: "fist" }, r: "mirror", item: 1 }, // 两手分开抓着东西的两边，东西在中间露出来                            // 双手捧着 item
    shrug: { l: { e: [10, 56], w: [HX - 58, Y0 + 30], h: "palm" }, r: "mirror" },                                  // 摊手
    clasp: { l: { e: [3, 56], w: [HX - 3, Y0 + 36], h: "fist" }, r: { e: [3, 56], w: [HX + 3, Y0 + 36], h: "fist" } }, // 双手合握
    salute: { r: { e: [26, 2], w: [HX + 36, EY - 2], h: "flat", front: 1, t: "down" } },                           // 敬礼：四指并拢，拇指贴在食指下面
    grip: { r: { e: [4, 56], w: [HX + 46, Y0 + 40], h: "fist", t: "up" }, item: "r" },                                      // 单手在身侧握着 item（法杖、剑竖着拿，不挡脸）
  };
  const POSE_NAMES = { rest: "垂手", hip: "叉腰", chest: "按胸口", mouth: "捂嘴", think: "托腮", wave: "挥手", point: "指", cheer: "加油", cross: "抱臂", hold: "捧东西", shrug: "摊手", clasp: "合握", salute: "敬礼", grip: "单手持物" };
  // 手里的东西：ITEMS[角色的 item](b, x, y, t, how)，x, y = 握的位置（hold 是两只手腕的中点、how = "both"；grip 是右手腕、how = "one"）；游戏里可以往 ITEMS 加
  const ITEMS = {
    book(b, x, y) { b.rect(x - 13, y - 9, 27, 19, "redD"); b.rect(x - 12, y - 8, 25, 17, "red"); b.rect(x - 9, y - 5, 19, 2, "gold"); b.line(x, y - 9, x, y + 9, "redD"); },
    letter(b, x, y) { b.rect(x - 12, y - 8, 25, 16, "cream"); b.path([x - 12, y - 8, x, y, x + 12, y - 8], "silver"); b.rect(x - 2, y - 1, 5, 4, "red"); },
    mug(b, x, y) { b.rect(x - 7, y - 10, 15, 16, "woodL"); b.rect(x - 7, y - 10, 15, 3, "cream"); b.ell(x + 10, y - 2, 3, 4, "woodD"); },
    // ---- 《余量》的道具 ----
    map(b, x, y, t, how) { // 卷着的管沟图纸（晒图纸卷成筒、皮筋扎着、两头露出蓝色的卷心）：两手拿横着，单手拿竖在身侧
      if (how === "one") { b.rect(x - 4, y - 34, 9, 44, "mapM"); b.line(x - 4, y - 34, x - 4, y + 9, "mapL"); b.line(x + 4, y - 34, x + 4, y + 9, "mapD"); b.ell(x + 0.5, y - 34, 4.5, 2, "mapL"); b.ell(x + 0.5, y - 34, 2, 1, "ck1"); b.rect(x - 4, y - 16, 9, 2, "rd1"); return; }
      b.rect(x - 22, y - 5, 45, 11, "mapM"); b.line(x - 22, y - 4, x + 22, y - 4, "mapL"); b.line(x - 22, y + 5, x + 22, y + 5, "mapD"); b.line(x - 22, y + 1, x + 9, y + 1, mix("mapM", "mapD", 0.5)); // 筒身 + 外层纸边
      b.ell(x + 23, y + 0.5, 2.5, 5.5, "mapL"); b.ell(x + 23, y + 0.5, 1.5, 3.5, "ck1"); b.px(x + 23, y, "ck3"); // 卷心
      b.rect(x - 4, y - 5, 2, 11, "rd1"); // 皮筋
    },
    logbook(b, x, y) { // 硬皮实验记录本：深绿布面、书脊、白标签、书口露出纸
      b.rect(x - 14, y - 10, 29, 21, "lbD"); b.rect(x - 13, y - 10, 27, 19, "lbM"); b.rect(x - 13, y - 10, 4, 19, "lbD"); b.line(x - 9, y - 10, x - 9, y + 8, "g5");
      b.rect(x - 4, y - 6, 13, 7, "cream"); b.line(x - 2, y - 4, x + 6, y - 4, "grey"); b.line(x - 2, y - 2, x + 4, y - 2, "grey");
      b.line(x - 12, y + 10, x + 14, y + 10, "white"); // 书口
    },
    torch(b, x, y, t, how) { // 手电：铝筒 + 黑色胶头；单手竖着、灯头朝上，两手拿横着、灯头朝右
      if (how === "both") { b.rect(x - 14, y - 3, 22, 7, "silverM"); b.line(x - 14, y - 3, x + 7, y - 3, "silverL"); b.line(x - 14, y + 3, x + 7, y + 3, "silverD"); b.rect(x + 8, y - 5, 7, 11, "ink"); b.rect(x + 15, y - 4, 2, 9, "am4"); b.rect(x - 14, y - 2, 2, 5, "ink"); return; }
      b.rect(x - 3, y - 22, 7, 30, "silverM"); b.line(x - 3, y - 22, x - 3, y + 7, "silverL"); b.line(x + 3, y - 22, x + 3, y + 7, "silverD"); for (let yy = y - 14; yy < y + 6; yy += 3) b.line(x - 2, yy, x + 2, yy, "silverD"); // 筒身的防滑纹
      b.rect(x - 5, y - 31, 11, 9, "ink"); b.rect(x - 4, y - 33, 9, 2, "am4"); b.rect(x - 3, y + 8, 7, 2, "ink");
    },
    orb(b, x, y, t) { const r = 9 + Math.round(Math.sin(t * 3)); b.ell(x + 0.5, y - 6, r + 3, r + 3, "violetL", null, 0.35); b.ell(x + 0.5, y - 6, r, r, "violet"); b.ell(x - 2, y - 9, 3, 3, "violetL"); b.px(x - 3, y - 10, "white"); },
  };

  // 平移画笔：按设计坐标（112 宽）画，落到拼好的宽画布上（左右各多 PADX，胳膊伸得出去）
  function padPen(b) { const m = Object.create(b); m.px = (x, y, c) => b.px(x + PADX, y, c); m.a = (x, y) => b.a(x + PADX, y); m.ox = PADX; return m; }
  const padLit = lit => (x, y) => lit(x - PADX, y);

  /* 手：在手腕处按小臂方向 u 画，v 垂直于 u；ts = 拇指朝哪边（+1 / -1，朝身体中线）
   *   照像素画的手：掌块 + 拇指 + 四指并成一块（手套形），手指之间只用 1 像素暗肤色线分，不用描边色
   *   手长约 24 像素（男生乘 1.15），手掌约是手腕的 1.4 倍宽；手指约占手长一半，指根连成以中指为顶的弧
   *   palm 张开（手心朝前）、fist 拳、point 食指伸出来、relax 垂着（正面看到的是手的侧面：窄，拇指压在前面，手指往里勾）、hide 不画
   */
  function hand(P, x, y, ux, uy, kind, ts, S, SD, male, back) {
    if (kind === "hide") return;
    const k = male ? 1.15 : 1, vx = -uy, vy = ux;
    const at = (a, b) => [x + (ux * a + vx * b) * k, y + (uy * a + vy * b) * k];
    const shape = (pts, c = S) => P.poly(pts.flatMap(([a, b]) => at(a, b)), c);
    const seam = pts => P.path(pts.flatMap(([a, b]) => at(a, b)), SD);
    // 四指并成一块（手套形）：指根在 a0，四根指尖 [横向位置, 长]；指尖之间留 1 像素的缺口，缺口往下一道指缝
    const mitt = (a0, F, w, sl = 0.6) => {
      const pts = [[a0, F[0][0] - w]], gaps = [];
      F.forEach(([b, len], j) => {
        pts.push([a0 + len - 1.2, b - w * 0.95], [a0 + len, b - w * 0.4], [a0 + len, b + w * 0.4], [a0 + len - 1.2, b + w * 0.95]);
        if (j < F.length - 1) { const g = [a0 + Math.min(len, F[j + 1][1]) - 1.6, (b + F[j + 1][0]) / 2]; pts.push(g); gaps.push(g); }
      });
      pts.push([a0, F[F.length - 1][0] + w]); shape(pts);
      for (const [ga, gb] of gaps) seam([[ga + 0.4, gb], [ga - (ga - a0) * sl, gb * 0.92]]);
    };
    if (kind === "palm") { // 手心朝前：掌块 + 四指一块（中指最长）+ 拇指往外斜出去；掌心一道纹
      shape([[0, -4], [9, -5.6], [11, -5.6], [11, 5.6], [9, 5.6], [0, 4]]);
      mitt(10, [[ts * 4, 9], [ts * 1.4, 10.5], [-ts * 1.4, 10], [-ts * 4, 8]].sort((p, q) => p[0] - q[0]), 1.5); // 食指（挨着拇指）、中指、无名指、小指
      shape([[1.5, ts * 3], [4, ts * 7.4], [7.5, ts * 9.6], [9.6, ts * 9], [8.6, ts * 6.6], [6.5, ts * 4.2]]); // 拇指
      if (back) seam([[10, -ts * 4.4], [10.5, 0], [10, ts * 4.4]]); else seam([[3, ts * 2.6], [6, ts * 3.6], [8.4, ts * 5.4]]); // 手背朝前：一排指节；手心朝前：母指球和掌心的分界
      return;
    }
    if (kind === "flat") { // 手背朝前贴在身上（搭在腰前、抱臂）：手背一块 + 四指并拢（三道指缝）+ 拇指贴着一侧
      shape([[0, -3.8], [10, -4.8], [16.5, -4.4], [18.6, -2.8], [19.2, -0.4], [18.7, 2], [17.4, 3.8], [10, 4.8], [0, 3.8]].map(([a, b]) => [a, b * ts]));
      shape([[2, ts * 3.4], [5, ts * 5.8], [9.6, ts * 6.2], [11.2, ts * 5], [8, ts * 4.2]]); // 拇指
      seam([[10, -ts * 4], [10.6, 0], [10, ts * 4]]); for (const b of [-2.4, 0, 2.4]) seam([[12.5, ts * b], [17.4, ts * b * 1.05]]); // 指根一排、指缝
      return;
    }
    if (kind === "relax") { // 垂着：正面看到手的侧面，窄；指尖往掌心那边（ts）勾；拇指压在前面，一道暗线分开
      // 照 Sadface「Hands Front View」：外侧是手掌（侧着看），朝中线那侧拇指鼓出来，拇指尖下面一道缺口，再往下是勾着的手指
      shape([[0, -3.4], [6, -4.2], [12, -4.5], [17, -3.9], [20.5, -2.4], [22.6, 0], [22, 2.4], [19.5, 3.4], [15.5, 3.2], [13.6, 2.2], [12.6, 4.6], [9, 5.4], [4.5, 4.6], [0, 3.4]].map(([a, b]) => [a, b * ts]));
      seam([[3, ts * 1.4], [7, ts * 2.2], [11.5, ts * 3.2]]); // 拇指和手掌的分界
      seam([[15.5, -ts * 1.6], [19, -ts * 0.2], [21, ts * 1.6]]); // 指头往掌心勾的那道
      return;
    }
    if (kind === "point") { // 指：手心朝前，食指挨着拇指竖起来；另外三指勾在掌心，比食指根低、不往外鼓（往外鼓会像竖着的是拇指）；拇指横压在勾着的手指前面
      shape([[0, -3.8], [2, -4.4], [8.5, -4.4], [10.4, -3], [10.8, -0.8], [9.6, 1.2], [8, 4.8], [2, 4.8], [0, 3.8]].map(([a, b]) => [a, b * ts]));
      shape([[7.5, ts * 1.2], [20, ts * 1.6], [21.4, ts * 3], [20, ts * 5], [7.5, ts * 5.4]]); seam([[10, ts * 1.4], [12.5, ts * 2]]); // 食指
      for (const b of [-2.8, -0.8]) seam([[8.8, ts * b], [10.4, ts * b]]); // 勾着的手指之间
      seam([[3, ts * 4.6], [6, ts * 2.8], [7.8, -ts * 0.2], [8.2, -ts * 2.4]]); // 拇指横压过来的下沿
      return;
    }
    // 拳：圆角方块，指节一排往小指那边低一点；三道指缝；拇指横压在食指、中指前面
    shape([[0, -4], [1.5, -5.4], [8.5, -5.8], [11, -4.6], [12, -1.6], [11.8, 2], [10.6, 4.8], [8, 5.8], [1.5, 5.4], [0, 4]].map(([a, b]) => [a, b * ts]));
    for (const b of [-2.6, -0.2, 2.2]) seam([[9.2 - b * 0.15, b * ts], [11.4 - b * 0.2, b * ts]]);
    seam([[3, ts * 5], [6.2, ts * 3.4], [8, ts * 0.4], [8.2, -ts * 2]]); // 拇指的下沿
  }

  /* ---------- 胳膊：照像素画和解剖资料拆成 上臂 → 肘 → 小臂 → 手腕 + 手，各段有自己的最宽点 ----------
   *   轮廓：两侧分开给半宽（外侧 = 背离身体那边），高点错开：外侧三角肌在上、内侧二头肌在中段；肘内侧凹、外侧凸；
   *         小臂最宽在靠肘 1/4 处，手腕收到最宽处的 6 成
   *   明暗：硬边两阶 + 缝里一阶「二影」（腋下、肘窝）；暗面宽度跟着肌肉团变（三角肌后缘、肌腹下面宽，肘、腕窄），
   *         不画和轮廓等宽平行的暗带（Slynyrd「Avoid even shading bands」）；受光一侧只在三角肌、小臂鼓包上点一道亮
   *   衣服：袖子比胳膊松一圈；褶从腋下斜出去、在肘弯挤成两道（褶放在小臂一侧）；卷袖子 = 肘上一道厚卷边、露出小臂；
   *         盔甲 = 肩甲（圆顶 + 几片顺着胳膊弯的甲片，每片上沿亮、下沿暗缝）+ 锁子甲 + 护肘 + 护臂
   *   出处：Rubenstein《Drawing the Arm》、Proko 小臂、ichi-up 012 / 094、Slynyrd Pixelblog 11 / 49、Saint11 Shading、のじゃ式ドット絵、Tsugumo 第 8 / 9 章
   */
  // 半宽（女生，像素）：o 外侧、i 内侧；sh = 暗面占整段宽的几成；hi = 受光一侧亮线宽
  const ANAT = {
    up: { o: [[0, 6], [0.18, 6.4], [0.42, 5.3], [0.72, 4.5], [1, 4.1]], i: [[0, 4.6], [0.3, 4.9], [0.6, 4.7], [0.88, 4], [1, 3.8]], sh: [[0, 0.5], [0.3, 0.3], [0.62, 0.42], [1, 0.26]], hi: [[0, 0], [0.06, 1.6], [0.3, 1.6], [0.42, 0]] },
    fore: { o: [[0, 4.1], [0.2, 5.1], [0.55, 4.1], [1, 3.2]], i: [[0, 3.8], [0.3, 4.4], [0.7, 3.5], [1, 3.1]], sh: [[0, 0.28], [0.25, 0.44], [0.7, 0.34], [1, 0.24]], hi: [[0, 0], [0.12, 1.3], [0.36, 1.3], [0.5, 0]] },
  };
  // 一段的中轴：p0 → p1（经 c）采样，每点带外侧法线 (nx, ny)、两侧半宽 o / i、参数 t
  function axis(p0, c, p1, side, fo, fi, n = 16) {
    const A = [];
    for (let j = 0; j <= n; j++) {
      const t = j / n, a = (1 - t) ** 2, m = 2 * (1 - t) * t, cc = t * t;
      const dx = 2 * (1 - t) * (c[0] - p0[0]) + 2 * t * (p1[0] - c[0]), dy = 2 * (1 - t) * (c[1] - p0[1]) + 2 * t * (p1[1] - c[1]), l = Math.hypot(dx, dy) || 1;
      A.push({ x: a * p0[0] + m * c[0] + cc * p1[0], y: a * p0[1] + m * c[1] + cc * p1[1], nx: (side * dy) / l, ny: (-side * dx) / l, o: fo(t), i: fi(t), t });
    }
    return A;
  }
  // 沿中轴围一圈：一边按 fa(q)、另一边按 fb(q) 偏出去（正 = 往外侧）；from..to 截一段
  function band(A, fa, fb, from = 0, to = 1) {
    const Q = A.filter(q => q.t >= from - 1e-6 && q.t <= to + 1e-6), pts = [];
    for (const q of Q) pts.push(q.x + q.nx * fa(q), q.y + q.ny * fa(q));
    for (let j = Q.length - 1; j >= 0; j--) { const q = Q[j]; pts.push(q.x + q.nx * fb(q), q.y + q.ny * fb(q)); }
    return pts;
  }
  const litOut = q => q.nx * LIGHT[0] + q.ny * LIGHT[1] > 0; // 外侧朝光
  const darkSide = (q, w) => (litOut(q) ? -q.i + w : q.o - w); // 背光那侧的轮廓往里 w
  const nearT = (A, t) => A.reduce((p, q) => (Math.abs(q.t - t) < Math.abs(p.t - t) ? q : p));
  const across = (P, A, t, c, m = 0.5) => { const q = nearT(A, t); P.line(q.x + q.nx * (q.o + m), q.y + q.ny * (q.o + m), q.x - q.nx * (q.i + m), q.y - q.ny * (q.i + m), c); }; // 横跨肢体一道线
  const rev = pts => { const o = []; for (let j = pts.length - 2; j >= 0; j -= 2) o.push(pts[j], pts[j + 1]); return o; };
  // 一段肢体：底色 → 暗面（宽度按 sh 曲线）→ 受光一侧一道亮
  function part(P, A, c, dk, lt, an) {
    P.poly(band(A, q => q.o, q => -q.i), c);
    const keep = (x, y) => P.a(x, y), sh = q => pf(an.sh, q.t) * (q.o + q.i);
    P.poly(band(A, q => darkSide(q, -1), q => darkSide(q, sh(q))), dk, 1, keep);
    if (lt) P.poly(band(A, q => (litOut(q) ? q.o - 1 : -q.i + 1), q => { const h = pf(an.hi, q.t); return litOut(q) ? q.o - 1 - h : -q.i + 1 + h; }), lt, 1, keep);
  }
  // 局部坐标：a = 沿 p0 → p1 走多远（像素），b = 往外侧多远
  const frame2 = (p0, p1, side) => { const dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l; return { l, at: (a, b) => [p0[0] + ux * a + side * uy * b, p0[1] + uy * a - side * ux * b] }; };
  const tone = c => { const q = col(c); return [q[0] * CEL.cloth[0], q[1] * CEL.cloth[1], q[2] * CEL.cloth[2]]; };

  // 一只胳膊：def = { e, w, h, front }（见 POSES）；垂着时手肘在腰带高度
  const REST = { e: [9, 60], r: [11, 54], h: "relax" }; // 待机：左手肘、右手肘（右手搭在腰前）
  function arm(s, of, sx, sy, def, t, side, T, torso) {
    const male = !!s.male, sl = of.def.sleeve(of), S = s.skin || "skin", SD = skinShade(S), k = male ? 1.15 : 1;
    const S0 = T([sx, sy]), el = T([sx + side * def.e[0], sy + def.e[1]]), wr = T(def.w); sx = S0[0]; sy = S0[1];
    const fx = wr[0] - el[0], fy = wr[1] - el[1], fl = Math.hypot(fx, fy) || 1, ux = fx / fl, uy = fy / fl;
    const bend = (p0, p1, kk) => [(p0[0] + p1[0]) / 2 + side * kk, (p0[1] + p1[1]) / 2];
    const cl = sl.c, dk = tone(cl), deep = mix(dk, "outline", 0.4), lt = mix(cl, "white", 0.22), edge = mix(sl.d, "outline", 0.6);
    const loose = sl.armor ? 1.2 : 1.2, bare = !!sl.roll, fl2 = bare ? 0 : 1.4, bellK = tt => (sl.bell ? 6.5 * tt * tt : 0);
    const up = new PB(OW, SH), fore = new PB(OW, SH), U = padPen(up), F = padPen(fore);
    // 上臂（袖子）：比胳膊松一圈；垫肩 pad 只加在肩头那一截
    const UA = axis(T([sx + side * 1.5, sy + 6]), bend([sx, sy], el, 1.2), el, side, tt => (pf(ANAT.up.o, tt) + loose) * k + (sl.pad || 0) * Math.max(0, 1 - tt * 4), tt => (pf(ANAT.up.i, tt) + loose) * k);
    const q0 = UA[0], rC = (q0.o + q0.i) * 0.5;
    part(U, UA, cl, dk, lt, ANAT.up);
    U.ell(q0.x + q0.nx * (q0.o - q0.i) * 0.5 + 0.5, q0.y - 1, rC, rC * 0.8, cl, (x, y) => !U.a(x, y)); // 肩头：四分之一圆，顶不高过躯干的斜肩，接着往下就是袖子外沿
    U.poly(band(UA, q => -q.i - 1, q => -q.i + 2.2, 0, 0.16), deep, 1, (x, y) => U.a(x, y)); // 腋下二影：贴着身体那一角
    // 小臂：长袖 = 袖子；卷袖 = 皮肤
    const FA = axis(el, bend(el, wr, 0.6), [wr[0] - ux * 1.5, wr[1] - uy * 1.5], side, tt => (pf(ANAT.fore.o, tt) + fl2 + bellK(tt)) * k, tt => (pf(ANAT.fore.i, tt) + fl2 + bellK(tt) * 0.85) * k);
    const rE = (FA[0].o + FA[0].i) * 0.5;
    part(F, FA, bare ? S : cl, bare ? SD : dk, bare ? mix(S, "white", 0.25) : lt, ANAT.fore);
    F.ell(el[0] + 0.5, el[1], rE, rE, bare ? S : cl, (x, y) => !F.a(x, y) && !U.a(x, y)); // 肘：两段接缝补圆
    const ax = sx - el[0], ay = sy - el[1], al = Math.hypot(ax, ay) || 1, bent = (ax * fx + ay * fy) / (al * fl) > -0.85;
    const UF = frame2([sx, sy], el, side), FF = frame2(el, wr, side);
    if (!sl.armor) { // 褶：腋下斜着往肘外侧一道（暗线 + 上沿一格亮）；上臂外侧一道从肩缝垂下来的竖褶
      const p1 = UF.at(UF.l * 0.2, -q0.i * 0.5), p2 = UF.at(UF.l * 0.55, (pf(ANAT.up.o, 0.55) + loose) * k * 0.35), pm = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2 + 1];
      strand(U, ...p1, ...pm, ...p2, 2.2, 0.6, deep, 6); strand(U, p1[0] - 1, p1[1] - 1, pm[0] - 1, pm[1] - 1, p2[0] - 0.5, p2[1] - 1, 1, 0.5, lt, 6);
      const v1 = UF.at(UF.l * 0.22, q0.o * 0.45), v2 = UF.at(UF.l * 0.62, q0.o * 0.3); strand(U, ...v1, (v1[0] + v2[0]) / 2 + side * 0.5, (v1[1] + v2[1]) / 2, ...v2, 1.4, 0.5, dk, 5);
    }
    if (!bare && !sl.armor) {
      // 肘：弯着时肘窝挤出两道 V；伸直时内侧一道短褶
      if (bent) {
        let bx = ax / al + ux, by = ay / al + uy; const bl = Math.hypot(bx, by) || 1; bx /= bl; by /= bl;
        for (const o of [0.5, 3.2]) { const a = FF.at(o + 1, -rE + 0.5), c2 = [el[0] + bx * 1.5 + ux * o, el[1] + by * 1.5 + uy * o]; strand(F, ...a, (a[0] + c2[0]) / 2, (a[1] + c2[1]) / 2, ...c2, 1.8, 0.6, deep, 4); }
      } else { const a = FF.at(3, -rE + 0.5), c2 = FF.at(7, -1); strand(F, ...a, (a[0] + c2[0]) / 2, (a[1] + c2[1]) / 2 + 0.5, ...c2, 1.6, 0.5, deep, 4); }
      if (FF.l > 18 && !sl.bell) { const a = FF.at(FF.l * 0.25, 1.5), c2 = FF.at(FF.l * 0.7, -1.5); strand(F, ...a, (a[0] + c2[0]) / 2, (a[1] + c2[1]) / 2, ...c2, 1.2, 0.5, dk, 4); } // 小臂袖子一道长褶（布料拧着）
      F.poly(band(FA, q => q.o + 0.5, q => -q.i - 0.5, 0.86, 1), sl.cuff || mix(cl, sl.d, 0.5)); // 袖口一圈边
    }
    if (bare) { // 卷袖子：上臂袖口卷成一道厚边，盖住肘上面一点；中间一道卷缝，背光那头压暗
      const r = typeof sl.roll === "string" ? sl.roll : mix(cl, "white", 0.12), w = () => (pf(ANAT.up.o, 1) + loose + 1.3) * k, wi = () => (pf(ANAT.up.i, 1) + loose + 1.3) * k;
      const RA = axis(UF.at(UF.l - 7, 0), UF.at(UF.l - 2.5, 0), UF.at(UF.l + 2.5, 0), side, w, wi, 4);
      const rl = mix(r, sl.d, 0.75);
      U.poly(band(RA, q => q.o, q => -q.i), r); U.poly(band(RA, q => darkSide(q, -1), q => darkSide(q, 2.5)), tone(r), 1, (x, y) => U.a(x, y));
      across(U, RA, 0, rl, 0); across(U, RA, 0.5, mix(r, sl.d, 0.5), -0.5); across(U, RA, 1, rl, 0); // 卷边上沿、中缝、下沿
    }
    if (sl.armor) armorArm(F, UF, FF, UA, sl, k, side, up, rE);
    if (sl.bracer) { // 护腕：两道皮带，背光一侧压暗，中间一道线
      const [bc, bd] = sl.bracer;
      for (const [a0, a1] of [[0.5, 0.625], [0.69, 0.94]]) F.poly(band(FA, q => q.o + 0.6, q => -q.i - 0.6, a0, a1), bc);
      F.poly(band(FA, q => darkSide(q, -1.6), q => darkSide(q, 2), 0.5, 0.94), tone(bc), 1, (x, y) => F.a(x, y)); across(F, FA, 0.81, bd, 0.2);
    }
    const L = new PB(OW, SH); L.blit(up, 0, 0); L.blit(fore, 0, 0); L.edge(edge);
    if (sl.frill && sl.bell) { const P = padPen(L), q = FA[FA.length - 1], w0 = (q.o + q.i) * 0.8; strand(P, wr[0] - ux * 2.5, wr[1] - uy * 2.5, wr[0] - ux * 1.5, wr[1] - uy * 1.5, wr[0] - ux * 0.5, wr[1] - uy * 0.5, w0, w0 * 0.85, sl.frill, 3); } // 喇叭袖里露出的内衬
    // 袖子顶端和躯干的肩合在一起：肩那一截挨着躯干的边不描（像衣服的一条缝，不像关节球）
    const sx0 = sx + PADX, rr = (rC * 1.5) ** 2, sc = col(cl);
    if (torso) for (let y = Math.max(1, L.by0); y <= Math.min(sy + q0.o + 4, L.by1); y++) for (let x = Math.max(1, L.bx0); x <= Math.min(OW - 2, L.bx1); x++) {
      if (!up.a(x, y) || (x - sx0) ** 2 + (y - sy) ** 2 > rr) continue;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !up.a(x + dx, y + dy) && torso(x + dx, y + dy));
      if (nb) { const i = (y * OW + x) * 4, j = (y * OW + x + (x < sx0 ? 1 : -1)) * 4; for (let q = 0; q < 3; q++) L.d[i + q] = up.d[j + 3] ? up.d[j + q] : sc[q]; }
    }
    // 小臂叠在大臂前面：沿小臂的边描一道（肘关节那一圈不描）
    const ex0 = el[0] + PADX, ey0 = el[1], re = (rE * 0.95) ** 2;
    for (let y = Math.max(1, fore.by0); y <= Math.min(SH - 2, fore.by1); y++) for (let x = Math.max(1, fore.bx0); x <= Math.min(OW - 2, fore.bx1); x++)
      if (fore.a(x, y) && up.a(x, y) && (x - ex0) ** 2 + (y - ey0) ** 2 > re && (!fore.a(x - 1, y) || !fore.a(x + 1, y) || !fore.a(x, y - 1) || !fore.a(x, y + 1))) L.px(x, y, edge);
    // 手：手腕从袖口里伸出来；背光一侧压 1–2 像素暗；袖口在手腕上投一道影
    // 拇指在手的哪一侧：按姿势写的 t（in 朝身体中线、out 朝外、up 朝上、down 朝下）换成画面方向，再看它落在 v 的哪边
    //   右手手心朝前、手指朝上时拇指朝身体中线，手背朝前时朝外（对着镜子比一下）。默认：手心朝前的张手、拳、指和垂着的手 → 朝中线；
    //   贴在身上的手（手背朝前，flat）→ 朝上；手按胸口朝上、捂嘴和敬礼朝下（POSES 里写 t）
    // 手的朝向：默认顺着小臂；POSES 写 hd: [dx, dy] 时手腕折一下（捂嘴时手横过来盖住嘴）
    const hl = def.hd ? Math.hypot(def.hd[0], def.hd[1]) || 1 : 1, hx = def.hd ? def.hd[0] / hl : ux, hy = def.hd ? def.hd[1] / hl : uy;
    const tdir = def.t || (def.h === "point" || def.h === "fist" ? "in" : def.h === "palm" ? (hy < -0.4 ? "in" : "up") : def.h === "flat" ? "up" : Math.abs(hy) > 0.6 ? "in" : "up");
    const D = { in: [Math.sign(HX - wr[0]) || 1, 0], out: [-(Math.sign(HX - wr[0]) || 1), 0], up: [0, -1], down: [0, 1] }[tdir];
    const H = new PB(OW, SH), HP = padPen(H), ts = -hy * D[0] + hx * D[1] >= 0 ? 1 : -1;
    const HS = sl.glove ? sl.glove[0] : S, HD = sl.glove ? sl.glove[1] : SD, qw = FA[FA.length - 1], wW = (qw.o + qw.i - (bare ? 0 : 2 * fl2) - bellK(1) * 1.85 * k) * 0.95;
    if (def.h !== "hide") {
      strand(HP, wr[0] - ux * 3, wr[1] - uy * 3, wr[0] - ux, wr[1] - uy, wr[0] + hx * 1.5, wr[1] + hy * 1.5, wW, wW * 0.95, HS, 3);
      hand(HP, wr[0], wr[1], hx, hy, def.h, ts, HS, HD, male, def.back);
      const sh = [], dx = -Math.sign(LIGHT[0]), dy = -Math.sign(LIGHT[1]);
      for (let y = H.by0; y <= H.by1; y++) for (let x = H.bx0; x <= H.bx1; x++) if (H.a(x, y) && !H.a(x + dx * 2, y + dy)) sh.push(x, y);
      for (let j = 0; j < sh.length; j += 2) H.px(sh[j], sh[j + 1], HD);
      if (!bare || sl.bracer) for (let b0 = -wW; b0 <= wW; b0 += 0.5) { const x = wr[0] - ux * 2 - uy * b0, y = wr[1] - uy * 2 + ux * b0; if (HP.a(x, y)) HP.px(x, y, HD); }
    }
    H.edge(mix(HD, "outline", 0.55));
    return { wr, front: def.front, arm: L, hand: H };
  }
  // 盔甲胳膊：肩甲 = 圆顶 + n 片顺着胳膊弯的甲片（从下往上画，上面压下面；每片上沿亮、下沿暗缝）；上臂锁子甲；护肘 = 圆护 + 外侧扇形翼；小臂护臂
  function armorArm(F, UF, FF, UA, sl, k, side, up, rE) {
    const [pc, phi, plo, pn] = sl.pauldron || ["silverM", "silverL", "silverD", 3], off = (UA[0].o - UA[0].i) * 0.5, W0 = (UA[0].o + UA[0].i) * 0.5 + 2.5;
    const pl = new PB(OW, SH), U = padPen(pl); // 肩甲先画在自己这层，压完暗面再贴到上臂上
    if (sl.mail) { const [m1, m2] = sl.mail; for (let y = up.by0; y <= up.by1; y++) for (let x = up.bx0; x <= up.bx1; x++) if (up.a(x, y) && (x + y * 2) % 4 === 0) up.px(x, y, (x + y) % 3 ? m1 : m2); }
    const arc = (a, half, sag) => { const pts = []; for (let j = 0; j <= 8; j++) { const u = -1 + j / 4; pts.push(...UF.at(a + sag * (1 - u * u), u * half + off)); } return pts; }; // 横跨胳膊、往手那边鼓的一条弧（内侧 → 外侧）
    for (let i = pn - 1; i >= 0; i--) {
      const a = 6 + i * 6 * k, half = W0 + 0.5 - i * 0.4, bot = arc(a + 7 * k, half - 0.3, 2.5);
      U.poly([...arc(a, half, 2.5), ...rev(bot)], pc); U.path(bot, plo); U.path(arc(a + 0.5, half - 1, 2.5), phi);
    }
    const dome = []; for (let j = 0; j <= 16; j++) { const th = Math.PI * (j / 16); dome.push(...UF.at(3 - Math.sin(th) * W0 * 0.85, Math.cos(th) * (W0 + 1.5) + off)); } // 外侧 → 内侧
    const lip = arc(6, W0 + 1.5, 3); U.poly([...dome, ...lip], pc); U.path(lip, plo);
    const gl = []; for (let j = 3; j <= 8; j++) { const th = Math.PI * (j / 16); gl.push(...UF.at(3 - Math.sin(th) * W0 * 0.6, Math.cos(th) * (W0 - 1.5) + off)); }
    const PA = axis(UF.at(-W0, off), UF.at(10, off), UF.at(6 + pn * 6 * k + 9 * k, off), side, () => W0 + 2, () => W0 + 2, 6); // 甲片背光那侧压一道暗（甲片是弯的）
    U.poly(band(PA, q => darkSide(q, -1), q => darkSide(q, (q.o + q.i) * 0.3)), tone(pc), 1, (x, y) => U.a(x, y)); U.path(gl, phi); // 圆顶上一道弧形高光
    up.blit(pl, 0, 0);
    const [cc, ch] = sl.couter || [pc, phi], ec = FF.at(1, 0);
    F.poly([FF.at(-2, rE), FF.at(2.5, rE + 3.5), FF.at(7, rE + 0.5), FF.at(5, 1)].flat(), cc); F.ell(ec[0] + 0.5, ec[1], 4 * k, 4 * k, cc); F.line(ec[0] - 2, ec[1] - 2, ec[0], ec[1] - 2, ch); // 护肘
    if (sl.vambrace) { // 护臂：小臂上一层板甲，受光一道亮、背光一道暗，手腕处外翻一圈
      const [vc, vh, vl] = sl.vambrace, VA = axis(FF.at(7, 0), FF.at(FF.l * 0.55, 0), FF.at(FF.l - 1, 0), side, tt => (pf(ANAT.fore.o, 0.25 + tt * 0.7) + 1.6) * k, tt => (pf(ANAT.fore.i, 0.25 + tt * 0.7) + 1.6) * k, 8);
      F.poly(band(VA, q => q.o, q => -q.i), vc); F.poly(band(VA, q => darkSide(q, -0.5), q => darkSide(q, 2.5)), vl);
      F.poly(band(VA, q => (litOut(q) ? q.o - 1.5 : -q.i + 1.5), q => (litOut(q) ? q.o - 3 : -q.i + 3), 0, 0.75), vh);
      F.poly(band(VA, q => q.o + 1, q => -q.i - 1, 0.875, 1), vc); across(F, VA, 0.875, vl, 1);
    }
  }

  // 按姿势画两只胳膊：{ back 画在头后面, front 画在脸前面 }。顺序：胳膊 → 手里的东西 → 手
  //   from / k = 从哪个姿势过渡过来、过渡到几成：手腕位置插值，手型过半再换
  function arms(s, of, pose, from, k, t, T = p => p, torso = null) {
    const sx = HX - (shoulderBase(s) - 6) * BODY_K, sy = Y0 + 12, out = { back: new PB(OW, SH), front: new PB(OW, SH) };
    const restOf = lr => (lr === "l" ? { e: REST.e, w: [sx + 6, sy + 100], h: "relax" } : { e: REST.r, w: [HX + 15, sy + 80], h: "flat" }); // 待机不对称：左手垂着、手在胯前；右手肘往外、手搭在腰带前面（左右一样会像立正）
    const at = (d, lr) => (d ? { e: d.e, w: typeof d.w === "function" ? d.w(t) : d.w, h: d.h, front: d.front, t: d.t, back: d.back, hd: d.hd } : restOf(lr));
    const side = (P, lr) => { const Q = POSES[P] || POSES.rest, d = Q[lr]; if (d !== "mirror") return at(d, lr); const m = at(Q.l, "l"); return { e: m.e, w: [2 * HX - m.w[0], m.w[1]], h: m.h, front: m.front, t: m.t, back: m.back, hd: m.hd && [-m.hd[0], m.hd[1]] }; };
    const lerp = (p, q, e) => [p[0] + (q[0] - p[0]) * e, p[1] + (q[1] - p[1]) * e];
    const A = ["l", "r"].map(lr => {
      let d = side(pose, lr);
      const S = [lr === "l" ? sx : 2 * HX - sx, sy];
      if (from && from !== pose && k < 1) { // 手腕绕肩走弧线（不是直线），到位时过头一点再回来
        const d0 = side(from, lr), e = easeOutBack(k), a0 = Math.atan2(d0.w[1] - S[1], d0.w[0] - S[0]), r0 = Math.hypot(d0.w[0] - S[0], d0.w[1] - S[1]);
        let da = Math.atan2(d.w[1] - S[1], d.w[0] - S[0]) - a0; da -= Math.round(da / (2 * Math.PI)) * 2 * Math.PI;
        const r1 = Math.hypot(d.w[0] - S[0], d.w[1] - S[1]), a = a0 + da * e, r = r0 + (r1 - r0) * e;
        d = { e: lerp(d0.e, d.e, e), w: [S[0] + Math.cos(a) * r, S[1] + Math.sin(a) * r], h: (k < 0.5 ? d0 : d).h, t: (k < 0.5 ? d0 : d).t, back: (k < 0.5 ? d0 : d).back, hd: (k < 0.5 ? d0 : d).hd, front: d.front || d0.front };
      }
      return arm(s, of, S[0], S[1], d, t, lr === "l" ? -1 : 1, T, torso);
    });
    for (const a of A) out[a.front ? "front" : "back"].blit(a.arm, 0, 0);
    const hold = (POSES[pose] || {}).item;
    if (hold && (!from || k >= 1)) {
      const p = hold === "r" ? A[1].wr : hold === "l" ? A[0].wr : [(A[0].wr[0] + A[1].wr[0]) / 2, (A[0].wr[1] + A[1].wr[1]) / 2 - 7]; // 两手拿：东西在拳头中间偏上
      const it = new PB(OW, SH); (ITEMS[s.item] || ITEMS.book)(padPen(it), p[0], p[1], t, hold === 1 ? "both" : "one"); it.edge(mix("ink", "shadow", 0.4)); out.back.blit(it, 0, 0);
    }
    for (const a of A) out[a.front ? "front" : "back"].blit(a.hand, 0, 0);
    return out;
  }

  /* ---------- 动起来：照 Live2D 的思路，用几个参数驱动整个人（头的倾斜、身体的倾斜、呼吸），头发当钟摆跟在后面 ----------
   * 每帧算出参数 → 头、身体、后发三层各自按「绕支点转一个小角度 + 不到 1 像素的平移」采样贴上去；胳膊按身体的变换重新画
   * 转图用 RotSprite 的办法：每层先 Scale2x 两遍放大 4 倍（只做一次，缓存），再按旋转后的坐标取样，线条不会断、不加新颜色；
   * 平移也按 1/4 像素取样，呼吸、晃动是连续的，不是一格一格跳
   */
  // Scale2x（EPX）：每个像素变 2×2，斜边上补角，保持原有颜色
  function epx2(L) {
    const W2 = L.w * 2, out = new PB(W2, L.h * 2), d = L.d, o = out.d, w = L.w, h = L.h;
    const same = (i, j) => d[i] === d[j] && d[i + 1] === d[j + 1] && d[i + 2] === d[j + 2] && d[i + 3] === d[j + 3];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const P = (y * w + x) * 4, A = y > 0 ? P - w * 4 : P, D = y < h - 1 ? P + w * 4 : P, C = x > 0 ? P - 4 : P, B = x < w - 1 ? P + 4 : P;
      const q = [P, P, P, P];
      if (same(C, A) && !same(C, D) && !same(A, B)) q[0] = A;
      if (same(A, B) && !same(A, C) && !same(B, D)) q[1] = B;
      if (same(D, C) && !same(D, B) && !same(C, A)) q[2] = C;
      if (same(B, D) && !same(B, A) && !same(D, C)) q[3] = D;
      for (let k = 0; k < 4; k++) { const ox = x * 2 + (k & 1), oy = y * 2 + (k >> 1), t = (oy * W2 + ox) * 4; for (let c = 0; c < 4; c++) o[t + c] = d[q[k] + c]; }
    }
    out.touch(); return out;
  }
  const UP4 = []; // 最近用过的放大图，超过 48 张就把最早的丢掉
  function up4(L) { if (L.up4) return L.up4; L.up4 = epx2(epx2(L)); UP4.push(L); if (UP4.length > 48) delete UP4.shift().up4; return L.up4; }
  // 把图层 L 绕 (px, py) 转 ang 弧度、再平移 (dx, dy)，贴到 dst 的 (ox, oy)；只看 L 里 y0..y1 这几行
  function drawXform(dst, L, ox, oy, ang, px, py, dx, dy, y0 = 0, y1 = L.h) {
    if (!ang && Math.abs(dx - Math.round(dx)) < 0.13 && Math.abs(dy - Math.round(dy)) < 0.13) { // 没转、整数位移：直接贴，最快也最干净
      const rx = Math.round(dx), ry = Math.round(dy);
      for (let y = y0; y < y1; y++) for (let x = 0; x < L.w; x++) { const i = (y * L.w + x) * 4; if (L.d[i + 3]) dst.px(ox + x + rx, oy + y + ry, [L.d[i], L.d[i + 1], L.d[i + 2]]); }
      return;
    }
    const U = up4(L), cs = Math.cos(ang), sn = Math.sin(ang), m = 6;
    const xa = ox + dx - m, xb = ox + dx + L.w + m, ya = oy + dy + y0 - m - Math.abs(sn) * L.w, yb = oy + dy + y1 + m + Math.abs(sn) * L.w;
    for (let Y = Math.max(0, Math.floor(ya)); Y < Math.min(dst.h, Math.ceil(yb)); Y++) for (let X = Math.max(0, Math.floor(xa)); X < Math.min(dst.w, Math.ceil(xb)); X++) {
      const qx = X + 0.5 - ox - dx - px, qy = Y + 0.5 - oy - dy - py, lx = cs * qx + sn * qy + px, ly = -sn * qx + cs * qy + py; // 反着转回图层里的坐标
      if (ly < y0 || ly >= y1 || lx < 0 || lx >= L.w) continue;
      const i = ((Math.floor(ly * 4)) * U.w + Math.floor(lx * 4)) * 4; if (U.d[i + 3]) dst.px(X, Y, [U.d[i], U.d[i + 1], U.d[i + 2]]);
    }
  }
  const rot = (p, c, ang) => { const cs = Math.cos(ang), sn = Math.sin(ang), x = p[0] - c[0], y = p[1] - c[1]; return [c[0] + cs * x - sn * y, c[1] + sn * x + cs * y]; };

  // 一次性动作：时长（毫秒）；曲线都带预备和回弹（先往反方向一点，再做，最后稍微过头再回来）
  const ACTS = { nod: 520, shake: 640, jump: 520, hop: 700, shiver: 700, bow: 1000, bob: 260 };
  const ACT_NAMES = { nod: "点头", shake: "摇头", jump: "蹦", hop: "连蹦两下", shiver: "发抖", bow: "鞠躬", bob: "说话时轻点一下" };
  // 每种表情头往哪边歪（度，正 = 往画面右边歪）、往下低几像素：歪头比换嘴型更像「有情绪」
  const EX_TILT = { neutral: [0, 0], smile: [2, 0], grin: [3, -0.5], shy: [5, 1.5], pout: [-4, 0], angry: [-2, 0.5], sad: [3, 2], cry: [4, 2], surprise: [0, -1.5], smug: [-3, -0.5] };
  const easeOutBack = k => { const c = 1.7; return 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2; };
  const smooth = k => k * k * (3 - 2 * k);
  // 参数：头角度 head（弧度）、身体角度 body、呼吸 br（0..1）、头的位移 hx hy、身体下沉 by、后发角度 hair
  function params(s, st, t) {
    if (st.still) return { head: 0, body: 0, br: 0, hx: 0, hy: 0, by: 0, hair: 0 };
    const seed = s.id.charCodeAt(0) * 0.37 + s.id.length, D = Math.PI / 180;
    const tiltOf = ex => EX_TILT[ex] || [0, 0];
    const ek = st.exFrom && st.exT != null ? easeOutBack(Math.min(1, st.exT / 380)) : 1, t0 = tiltOf(st.exFrom || st.ex), t1 = tiltOf(st.ex);
    const exTilt = t0[0] + (t1[0] - t0[0]) * ek, exDrop = t0[1] + (t1[1] - t0[1]) * ek;
    const idleHead = a => 1.3 * Math.sin(a * 0.55 + seed) + 0.6 * Math.sin(a * 1.31 + seed * 2.1); // 待机时头慢慢歪来歪去（度）
    const br = 0.5 - 0.5 * Math.cos((t / 3.6) * Math.PI * 2 + seed); // 呼吸：3.6 秒一次，进出都是缓的
    let head = idleHead(t) + exTilt + (st.speaking ? 0.9 * Math.sin(t * 6.5) : 0), body = 0.5 * Math.sin(t * 0.43 + seed * 1.7);
    let hx = 0, hy = exDrop - br * 0.3, by = -br * 0.7; // by = 身体（连头）一起动多少；hx hy = 头相对身体再动多少
    const k = st.act && ACTS[st.act] && st.actT >= 0 ? st.actT / ACTS[st.act] : 9;
    if (k < 1) switch (st.act) {
      case "nod": hy += k < 0.12 ? -1.2 * smooth(k / 0.12) : k < 0.35 ? -1.2 + 4.7 * smooth((k - 0.12) / 0.23) : k < 0.55 ? 3.5 - 3.5 * smooth((k - 0.35) / 0.2) : k < 0.75 ? 2.5 * smooth((k - 0.55) / 0.2) : 2.5 * (1 - smooth((k - 0.75) / 0.25)); break;
      case "shake": { const e = Math.sin(k * Math.PI * 4) * (1 - k * 0.6); head += e * 6; hx += e * 2.2; break; }
      case "jump": { const sq = k < 0.18 ? smooth(k / 0.18) : k < 0.3 ? 1 - smooth((k - 0.18) / 0.12) : 0, up = k >= 0.2 && k < 0.8 ? Math.sin(((k - 0.2) / 0.6) * Math.PI) : 0, land = k >= 0.8 ? Math.sin(((k - 0.8) / 0.2) * Math.PI) : 0;
        by += sq * 2.5 - up * 9 + land * 2; hy += sq * 1 + land * 1 - up * 0.8; break; } // 先蹲、再起跳、落地再压一下；头比身体多压一点
      case "hop": { const q = (k * 2) % 1, up = Math.sin(q * Math.PI); by -= up * 4.5; hy -= up * 0.5; break; }
      case "shiver": { const e = Math.sin(t * 80) * (1 - k * 0.5); hx += e * 1.1; head += e * 1.2; break; }
      case "bow": { const q = k < 0.15 ? -0.15 * smooth(k / 0.15) : k < 0.45 ? -0.15 + 1.15 * smooth((k - 0.15) / 0.3) : k < 0.7 ? 1 : 1 - smooth((k - 0.7) / 0.3); by += q * 3; hy += q * 5; break; }
      case "bob": hy += Math.sin(k * Math.PI) * 1.2; head += Math.sin(k * Math.PI) * 1.5; break;
    }
    // 后发是钟摆：跟着头和身体转，但晚 0.18 秒，还会甩过头一点再回来；平时自己也轻轻荡
    const lag = 0.18, headLag = idleHead(t - lag) + exTilt, swing = (head - headLag) * 0.7;
    const hair = headLag + swing + 0.8 * Math.sin(t * 1.1 + seed * 0.7) + body;
    return { head: head * D, body: body * D, br, hx, hy, by, hair: hair * D };
  }
  // 拼一帧立绘：st = { ex, exFrom, exT, blink, talk, speaking, outfit, pose, poseFrom, poseK, act, actT（毫秒）, still }，t = 秒
  function compose(s, st, t) {
    const P = layersOf(s, st.ex || "neutral", st), of = outfitOf(s, P.outfit), M = params(s, st, t), out = new PB(OW, SH);
    const hip = [HX, SH], neck = [HX, CHIN - 4], T = p => { const q = rot(p, hip, M.body); return [q[0], q[1] + M.by]; }; // 身体：绕胯转、整体下沉
    const nk = T(neck), crown = [HX, 32];
    drawXform(out, P.back, PADX, 0, M.hair, crown[0], crown[1], nk[0] - neck[0] + M.hx * 0.6, nk[1] - neck[1] + M.hy * 0.8); // 后发：绕头顶转（钟摆）
    drawXform(out, P.body, PADX, 0, M.body, hip[0], hip[1], 0, M.by);
    const torsoMask = (x, y) => P.body.a(x - PADX, Math.round(y - M.by)); // 袖子顶端要和躯干的肩合在一起
    const A = arms(s, of, st.pose || "rest", st.poseFrom, st.poseK == null ? 1 : st.poseK, t, p => { const q = T(p); return p[1] < Y0 + 40 ? [q[0], q[1] - M.br * 0.5] : q; }, torsoMask); // 肩跟着呼吸往上提一点
    for (let y = Math.max(2, A.back.by0 + 2); y <= Math.min(SH - 1, A.back.by1 + 2); y++) for (let x = Math.max(2, A.back.bx0 + 2); x <= Math.min(OW - 1, A.back.bx1 + 2); x++) // 胳膊在身上投的影：光从左上来，往右下错 2 像素
      if (A.back.a(x - 2, y - 2) && !A.back.a(x, y) && out.a(x, y)) { const i = (y * OW + x) * 4; for (let q = 0; q < 3; q++) out.d[i + q] *= CEL.cloth[q]; }
    out.blit(A.back, 0, 0);
    drawXform(out, P.head, PADX, 0, M.body + M.head, neck[0], neck[1], nk[0] - neck[0] + M.hx, nk[1] - neck[1] + M.hy, 0, CHIN + 14); // 头：绕下巴上面一点转
    out.blit(A.front, 0, 0);
    out.selout(0.34); out.headDx = nk[0] - neck[0] + M.hx; out.headDy = nk[1] - neck[1] + M.hy;
    return out;
  }
  // 静态立绘（缩略图、CG、导出 PNG 用）：bust(角色, 表情, { blink, talk, outfit, pose })
  function bust(s, ex = "neutral", o = {}) {
    const key = [s.id, ex, o.blink || 0, o.talk ? 1 : 0, o.outfit || "", o.pose || "rest"].join(":");
    return bust.cache[key] || (bust.cache[key] = compose(s, { ex, blink: o.blink, talk: o.talk, outfit: o.outfit, pose: o.pose, still: 1 }, 0));
  }
  bust.cache = {};

  /* 角色：id 要和 registry.js 里 SPEAKERS 的 portrait 对上
   *   hair: long | bob | twintail | ponytail | sidetail | short；bangs: "blunt" 齐刘海；ahoge: 1 呆毛
   *   hairC: black brown blonde pink silver blue red violet（或 [深, 中, 浅] 色名）；eyeC: blue green amber violet red brown grey
   *   outfits: { 服装名: { type: sailor|blazer|sweater|hoodie|gakuran|shirt, main: [深, 中, 浅], acc: 领结色, tie: 1 } }，第一个是默认
   *   age: 年龄（必填）。胸的体积明暗只给 18 岁以上的女性角色；bust 显式写了以显式为准
   *   male: 1 男生体型和眼型；acc: glasses | earrings；ribbon / pin / headband：发饰颜色
   *   ears: "elf" 尖耳朵；hat: "witch" 巫师帽（hatC [深, 中, 浅]、hatBand 帽带色、hatGem 宝石色）；item: book letter mug orb（hold / grip 姿势拿着）
   *   expr: 覆盖某个表情的局部，例 { neutral: { mouth: "small" } }（平时就抿着嘴的人）
   *   《余量》加的：hair "buzz" 寸头 / "lowtie" 低扎；tail: "short" 短马尾（配 ponytail）；sideLen / sideW 侧发长度、粗细；tips 自己的刘海表；
   *     face: square 方 / round 圆 / long 细长；marks { brow 眉间竖纹, fold 法令纹, under 眼袋线, bags 眼下发青 }；thickBrow 女生也画粗眉
   */
  // 《余量》的三个人。剪影分开靠：发型（寸头 / 短马尾 / 低扎长发）、发色（灰白 / 黑 / 深棕）、眼镜（只有郑岩戴）、脸型（方 / 圆 / 细长）
  const SUIT = { type: "suit", main: ["stD", "stM", "stL"], glove: ["gvM", "gvD"] }; // 三人同款的防护服
  const CAST = [
    { id: "zheng", name: "郑岩", age: 56, male: 1, face: "square", skin: "skinT", hair: "buzz", hairC: ["ashD", "ash", "ashL"], eyeC: "brown", acc: "glasses",
      marks: { brow: 1, fold: 1, under: 1 }, expr: { neutral: { eye: "soft" } }, item: "torch",
      outfits: { shift: { type: "shift", main: ["nvD", "nvM", "nvL"] }, suit: SUIT }, note: "反应堆值班长：灰白寸头、方脸、旧黑框眼镜、眉间竖纹" },
    { id: "kuang", name: "邝丽娟", age: 23, face: "round", hair: "ponytail", tail: "short", sideLen: 80, thickBrow: 1, hairC: ["hairB", "bkM", "bkL"], eyeC: "brown", bust: 0.6, item: "map",
      tips: [[-29, 56, 11, -3], [-20, 52, 13, -3], [-11, 54, 13, -2], [-3, 50, 9, 0], [5, 54, 14, 2], [15, 51, 12, 3], [24, 55, 12, 3], [30, 58, 9, 2]], // 刘海短一截，粗眉露出来
      outfits: { shift: { type: "shift", main: ["gbD", "gbM", "gbL"], roll: 1 }, suit: SUIT }, note: "入职一个月的操作员：黑发短马尾、圆脸、眉毛有点粗" },
    { id: "fang", name: "方以宁", age: 31, face: "long", hair: "lowtie", hairC: ["fbD", "fbM", "fbL"], eyeC: ["brownD", "fbL", "brownL"], sideLen: 100, sideW: 6, bust: 0.7, item: "logbook",
      tips: [[-30, 72, 12, -2], [-24, 68, 14, -4], [-17, 64, 14, -7], [-10, 59, 13, -9], [-2, 53, 12, -10], [6, 48, 11, -8], [16, 44, 9, -3], [27, 50, 8, 2]], // 偏分：一片斜着扫到画面左边、盖住眼角，右边露出额头
      marks: { bags: 1 }, expr: { neutral: { eye: "soft" } },
      outfits: { coat: { type: "coat", main: ["ctD", "ctM", "ctL"] }, suit: SUIT }, note: "做辐照实验的研究员：深棕长发低扎、细长脸、眼下发青" },
  ];
  const castById = Object.fromEntries(CAST.map(c => [c.id, c]));

  /* ---------- 表情符号（画在头顶右侧） ---------- */
  const EMOTES = {
    exclaim(b, x, y) { b.rect(x - 1, y - 12, 3, 8, "red"); b.rect(x - 1, y - 2, 3, 3, "red"); },
    question(b, x, y) { b.path([x - 3, y - 9, x - 1, y - 12, x + 2, y - 12, x + 4, y - 9, x + 1, y - 6, x, y - 4], "blue"); b.rect(x - 1, y - 1, 2, 2, "blue"); },
    sweat(b, x, y) { b.poly([x, y - 12, x + 4, y - 4, x + 2, y, x - 2, y, x - 4, y - 4], "blueL"); b.px(x - 1, y - 4, "white"); },
    anger(b, x, y) { b.line(x - 5, y - 9, x - 1, y - 9, "red"); b.line(x - 3, y - 11, x - 3, y - 7, "red"); b.line(x + 1, y - 5, x + 5, y - 5, "red"); b.line(x + 3, y - 7, x + 3, y - 3, "red"); },
    heart(b, x, y) { b.ell(x - 3, y - 8, 3.5, 3.5, "rose"); b.ell(x + 3, y - 8, 3.5, 3.5, "rose"); b.poly([x - 6.5, y - 7, x + 6.5, y - 7, x, y + 1], "rose"); b.px(x - 4, y - 9, "white"); },
    note(b, x, y) { b.rect(x - 4, y - 3, 3, 3, "violet"); b.rect(x + 3, y - 5, 3, 3, "violet"); b.line(x - 2, y - 12, x - 2, y - 3, "violet"); b.line(x + 5, y - 14, x + 5, y - 5, "violet"); b.line(x - 2, y - 12, x + 5, y - 14, "violet"); },
    dots(b, x, y) { for (const dx of [-6, 0, 6]) b.rect(x + dx - 1, y - 4, 2, 2, "grey"); },
    sparkle(b, x, y) { b.line(x, y - 12, x, y, "gold"); b.line(x - 6, y - 6, x + 6, y - 6, "gold"); b.px(x, y - 6, "white"); b.line(x + 8, y - 12, x + 8, y - 8, "goldL"); b.line(x + 6, y - 10, x + 10, y - 10, "goldL"); },
    gloom(b, x, y) { for (const dx of [-30, -24, -18, -12, -6]) b.line(x + dx, y + 2, x + dx, y + 14, "violetD"); },
  };
  const EMOTE_NAMES = { exclaim: "！", question: "？", sweat: "汗", anger: "怒", heart: "心", note: "音符", dots: "……", sparkle: "闪光", gloom: "阴沉" };

  /* ---------- 场景 480×270 ---------- */
  const W = 480, H = 270;
  // 时段调色。本作：sunset 当「黎明前」用，调成灰蓝（不偏暖）；场景自己按 o.tod 画夜里的光，所以夜里只轻轻压一层冷青，不再整体压暗一半
  const TOD = { day: null, sunset: ["dawnK", 0.3], night: ["nightK", 0.42] };
  const skyStops = tod => (tod === "sunset" ? ["sunsetP", "sunset", "sunsetL"] : tod === "night" ? ["ink", "night", "navy"] : ["sky", "skyL", "white"]);
  function sky(b, y0, y1, tod) { b.vgrad(0, y0, W, y1 - y0, skyStops(tod)); }
  function windowRow(b, x0, y0, n, w, h, gap, tod, weather, t = 0) {
    for (let i = 0; i < n; i++) {
      const x = x0 + i * (w + gap); b.rect(x - 3, y0 - 3, w + 6, h + 6, "silver"); b.vgrad(x, y0, w, h, weather === "rain" ? ["grey", "dusk", "shadow"] : skyStops(tod)); if (weather === "rain") rainIn(b, x, y0, w, h, t + i, 12);
      b.rect(x + (w >> 1) - 1, y0, 2, h, "silver"); b.line(x + 4, y0 + h - 6, x + 14, y0 + 4, "white");
    }
  }
  // 在一块矩形里下雨（窗外、室外都用它）
  function rainIn(b, x, y, w, h, t, n = 30) { for (let i = 0; i < n; i++) { const rx = x + ((i * 41 + t * 30) % w), ry = y + ((i * 67 + t * 170) % h); b.line(rx, ry, rx - 1, Math.min(y + h - 1, ry + 5), "blueL"); } }
  function floorPlanks(b, y0, c1, c2) { b.vgrad(0, y0, W, H - y0, [c1, c2]); for (let y = y0 + 8; y < H; y += 9 + ((y - y0) >> 4)) b.line(0, y, W, y, c2); }
  function glow(b, x, y, r, c, a) { b.ell(x, y, r, r, c, null, a); b.ell(x, y, r * 0.55, r * 0.55, c, null, a * 1.6); }
  // CG 用：把立绘放大 scale 倍贴到 (x, y)（最近邻放大，保持像素感）
  function bigBust(b, id, ex, scale, x, y, o = {}) {
    const sp = bust(castById[id], ex, o), W2 = Math.round(sp.w * scale), H2 = Math.round(sp.h * scale), x0 = x - Math.round(PADX * scale); // (x, y) 仍是设计画布的左上角
    for (let j = 0; j < H2; j++) for (let i = 0; i < W2; i++) {
      const si = ((Math.floor(j / scale)) * sp.w + Math.floor(i / scale)) * 4; if (!sp.d[si + 3]) continue;
      b.px(x0 + i, y + j, [sp.d[si], sp.d[si + 1], sp.d[si + 2]]);
    }
  }
  // 飘落的小颗粒（落叶、雪、灰、纸屑……看本作要什么）：c = 一个颜色或 [亮, 暗]，默认中性灰
  function particles(b, t, n, c = ["silver", "grey"]) {
    const [L, D] = Array.isArray(c) && typeof c[0] !== "number" ? c : [c, c]; // [r, g, b] 当一个颜色
    for (let i = 0; i < n; i++) { const x = (i * 53 + t * 22) % (W + 20) - 10, y = (i * 37 + t * 30 + Math.sin(t + i) * 8) % (H + 10); b.rect(x, y, 2, 1, L); b.px(x + 1, y + 1, D); }
  }

  /* ==== 《余量》场景 BEGIN ==== */
  /* 夜里的画法：先按「灯全开」画固有色 → lightPass 乘环境光 + 各个光源（按距离衰减、量化成几档、档间 Bayer 抖动，是像素画的硬边光斑）
   *   → 再画自己发光的东西（表盘、光字牌、水里的切伦科夫光）和光晕 bloom
   * 不动的部分按（场景, 时段, 开关）缓存成底图 baked()，每帧 paste() 贴上去，只现画会动的（指针、闪灯、水纹、手电）
   * o.tod：night / sunset（本作当「黎明前」）/ day；o.props：场景开关（hall 的 low = 水位降下去、control 的 alarm = 警报灯转起来）
   */
  const SCK = {};
  function baked(key, draw) { let L = SCK[key]; if (!L) { L = new PB(W, H); draw(L); L.touch(); SCK[key] = L; } return L; }
  function paste(b, L) { b.d.set(L.d); b.touch(); }
  const todOf = o => (o.tod === "night" ? "night" : o.tod === "sunset" ? "dawn" : "day");
  const propOf = (o, k) => !!(o.props && o.props[k]);
  // 乘法打光。光源 { x, y, r, ry, k 强度, c 光色, p 衰减指数（大 = 往中心收）, steps 档数 }
  function lightPass(b, amb, lights, steps = 4) {
    const w = b.w, h = b.h, n = w * h, m = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { m[i * 3] = amb[0]; m[i * 3 + 1] = amb[1]; m[i * 3 + 2] = amb[2]; }
    for (const L of lights) {
      const c = col(L.c || "white"), ry = L.ry || L.r, p = L.p || 1, st = L.steps || steps, k = L.k / 255;
      for (let y = Math.max(0, Math.floor(L.y - ry)); y <= Math.min(h - 1, L.y + ry); y++) for (let x = Math.max(0, Math.floor(L.x - L.r)); x <= Math.min(w - 1, L.x + L.r); x++) {
        const dx = (x + 0.5 - L.x) / L.r, dy = (y + 0.5 - L.y) / ry, d = Math.sqrt(dx * dx + dy * dy); if (d >= 1) continue;
        const q = Math.floor((1 - d) ** p * st + bay(x, y)) / st; if (q <= 0) continue;
        const i = (y * w + x) * 3; m[i] += c[0] * k * q; m[i + 1] += c[1] * k * q; m[i + 2] += c[2] * k * q;
      }
    }
    const d = b.d; for (let i = 0; i < n; i++) { const j = i * 4, q = i * 3; d[j] = Math.min(255, d[j] * m[q]); d[j + 1] = Math.min(255, d[j + 1] * m[q + 1]); d[j + 2] = Math.min(255, d[j + 2] * m[q + 2]); }
    b.touch();
  }
  // 发光体的光晕：越近越往 c 拉，量化成几档
  function bloom(b, x, y, r, ry, c, k, steps = 3, p = 1.5, keep) {
    c = col(c); ry = ry || r; const d = b.d;
    for (let j = Math.max(0, Math.floor(y - ry)); j <= Math.min(b.h - 1, y + ry); j++) for (let i = Math.max(0, Math.floor(x - r)); i <= Math.min(b.w - 1, x + r); i++) {
      const dx = (i + 0.5 - x) / r, dy = (j + 0.5 - y) / ry, e = Math.sqrt(dx * dx + dy * dy); if (e >= 1 || (keep && !keep(i, j))) continue;
      const q = Math.min(1, (Math.floor((1 - e) ** p * steps + bay(i, j)) / steps) * k); if (q <= 0) continue;
      const n = (j * b.w + i) * 4; for (let m = 0; m < 3; m++) d[n + m] += (c[m] - d[n + m]) * q;
    }
  }
  // 凸多边形内（pts = [x0,y0,x1,y1,...]，顺逆时针都行）
  const inPoly = pts => (x, y) => { let s = 0; for (let i = 0; i < pts.length; i += 2) { const ax = pts[i], ay = pts[i + 1], bx = pts[(i + 2) % pts.length], by = pts[(i + 3) % pts.length], c = (bx - ax) * (y + 0.5 - ay) - (by - ay) * (x + 0.5 - ax); if (c) { if (s && Math.sign(c) !== s) return false; s = Math.sign(c); } } return true; };
  // 小透视：相机在 (ex, ey, ez) 朝 +y 看、往下俯 pit 弧度；世界 x 右、y 往里、z 往上 → 画面坐标
  const persp = (cx, cy, F, ex, ey, ez, pit) => { const cp = Math.cos(pit), sp = Math.sin(pit); return (x, y, z) => { const dy = y - ey, dz = z - ez, f = dy * cp - dz * sp, u = dy * sp + dz * cp; return [cx + ((x - ex) * F) / f, cy - (u * F) / f]; }; };
  const flat = (P, pts) => pts.flatMap(p => P(...p));
  const seg = (b, P, a, c2, c) => { const p = P(...a), q = P(...c2); b.line(p[0], p[1], q[0], q[1], c); };
  const keepPen = (b, keep) => { const m = Object.create(b); m.px = (x, y, c) => { if (keep(Math.floor(x), Math.floor(y))) b.px(x, y, c); }; return m; }; // 只画在 keep 里面的画笔（线、折线也能裁）
  const hsh = (i, k = 1) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); }; // 0..1 的确定性随机
  const vnoise = (x, y, c, k = 1) => { const gx = Math.floor(x / c), gy = Math.floor(y / c), fx = x / c - gx, fy = y / c - gy, h = (i, j) => hsh((gx + i) * 57 + (gy + j) * 131, k), sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); return (h(0, 0) * (1 - sx) + h(1, 0) * sx) * (1 - sy) + (h(0, 1) * (1 - sx) + h(1, 1) * sx) * sy; }; // 值噪声：锈、起皮这种不规则的斑

  /* ---------- 控制室 ----------
   * 一整面灰绿漆的老仪表盘（6 块盘：光字牌、圆指针表、条形图记录仪、竖条表、模拟图、指示灯）+ 斜面操作台 + 右边值班桌（转盘电话、交接班记录、搪瓷缸）
   * 夜里顶灯关着，只有表盘背光和亮着的光字牌、警示灯 */
  const CT = { PY: 50, BY: 136, FY: 180 }; // 立盘上沿、操作台台面、地面
  const CT_LIT = [[0, 0, 1, "am3"], [0, 2, 4, "am3"], [2, 0, 3, "rd2"], [5, 1, 2, "am3"], [5, 0, 5, "am3"]]; // 亮着的光字牌：[盘, 行, 列, 色]
  const CT_BLINK = [5, 2, 0]; // 慢闪的那块
  const tileXY = (bay, r, c) => [bay * 80 + 7 + c * 11, CT.PY + (bay === 2 ? 50 : 12) + r * 8];
  function ctDial(L, x, y, r, face, v) { // 圆指针表：黑边、表盘、刻度弧、指针（v = 0..1）
    L.ell(x, y, r + 1.5, r + 1.5, "pn0"); L.ell(x, y, r, r, face);
    const py = y + r * 0.4, R = r * 1.05;
    for (let k = 0; k <= 8; k++) { const a = Math.PI * (-0.78 + k * 0.07), l = k % 4 ? 0.82 : 0.7; L.line(x + Math.cos(a) * R * l, py + Math.sin(a) * R * l, x + Math.cos(a) * R * 0.95, py + Math.sin(a) * R * 0.95, "pn0"); }
    L.px(x + Math.cos(Math.PI * -0.27) * R * 0.88, py + Math.sin(Math.PI * -0.27) * R * 0.88, "rd1"); // 红线
    const a = Math.PI * (-0.78 + v * 0.56); L.line(x, py, x + Math.cos(a) * R * 0.9, py + Math.sin(a) * R * 0.9, "ink"); L.px(x, py, "ink");
  }
  function ctEdge(L, x, y, face, v) { L.rect(x - 1, y - 1, 9, 32, "pn0"); L.rect(x, y, 7, 30, face); for (let yy = y + 2; yy < y + 30; yy += 4) L.line(x, yy, x + (yy % 8 ? 1 : 2), yy, "pn1"); L.rect(x + 2, Math.round(y + 28 - v * 26), 5, 2, "rd1"); }
  function ctChart(L, x, y, w, h, t, face) { // 条形图记录仪：纸往下走，两支笔左右摆
    L.rect(x - 2, y - 2, w + 4, h + 4, "pn0"); L.rect(x, y, w, h, face);
    for (let xx = x + 4; xx < x + w; xx += 6) L.line(xx, y, xx, y + h - 1, mix(face, "green", 0.25));
    const sc = Math.floor(t * 6) % 7; for (let yy = y + sc; yy < y + h; yy += 7) L.line(x, yy, x + w - 1, yy, mix(face, "green", 0.18));
    for (const [c, ph, base] of [["rd1", 0, 0.35], ["blueD", 2.1, 0.62]]) {
      let px0 = null;
      for (let yy = 0; yy < h; yy++) { const s = (yy - t * 6) * 0.21 + ph, xx = x + w * base + Math.sin(s) * 4 + Math.sin(s * 2.7) * 2; if (px0 != null) L.line(px0, y + yy - 1, xx, y + yy, c); px0 = xx; }
      L.rect(px0 - 1, y, 3, 2, "ink");
    }
    L.line(x, y + h * 0.5, x + w - 1, y + h * 0.5, mix(face, "white", 0.3)); // 玻璃反光
  }
  function ctTiles(L, bay, rows) { const [x, y] = tileXY(bay, 0, 0); L.rect(x - 2, y - 2, 6 * 11 + 3, rows * 8 + 3, "pn0"); for (let r = 0; r < rows; r++) for (let c = 0; c < 6; c++) { const [tx, ty] = tileXY(bay, r, c); L.rect(tx, ty, 10, 7, "pn4"); L.rect(tx + 2, ty + 3, 6, 1, "pn2"); } }
  function ctLamps(L, x, y, n, on) { for (let i = 0; i < n; i++) { L.rect(x + i * 7 - 1, y - 1, 5, 5, "pn0"); L.rect(x + i * 7, y, 3, 3, on ? on(i) : "pn1"); } }
  const CT_LAMP = i => (i % 5 === 1 ? "jade" : i % 7 === 3 ? "rd2" : null);
  // 表盘、光字牌这些「自己发光」的东西：白天按固有色画在底图里；夜里打完光再画一遍（背光色），再加光晕
  function ctFaces(L, tod, t) {
    const face = tod === "day" ? "mf" : "mfN";
    ctDial(L, 18, CT.PY + 50, 8, face, 0.42); ctDial(L, 40, CT.PY + 50, 8, face, 0.66); ctDial(L, 62, CT.PY + 50, 8, face, 0.3);
    ctChart(L, 92, CT.PY + 12, 56, 40, t, tod === "day" ? "paper" : "mfN");
    for (let k = 0; k < 6; k++) ctEdge(L, 168 + k * 11, CT.PY + 12, face, [0.5, 0.62, 0.58, 0.81, 0.44, 0.7][k]);
    ctDial(L, 280, CT.PY + 30, 15, face, 0.55); ctDial(L, 256, CT.PY + 66, 7, face, 0.5); ctDial(L, 304, CT.PY + 66, 7, face, 0.7);
    ctDial(L, 340, CT.PY + 66, 7, face, 0.35); ctDial(L, 380, CT.PY + 66, 7, face, 0.6);
    ctChart(L, 412, CT.PY + 44, 56, 26, t + 3, tod === "day" ? "paper" : "mfN");
  }
  function controlBase(L, tod) {
    const { PY, BY, FY } = CT, night = tod !== "day";
    L.rect(0, 0, W, 24, "g3"); // 顶棚
    for (const x0 of [24, 184, 344]) { L.rect(x0, 6, 112, 9, "cn2"); L.rect(x0 + 2, 8, 108, 5, night ? "cn3" : "white"); for (let x = x0 + 15; x < x0 + 110; x += 16) L.line(x, 8, x, 12, "cn3"); } // 格栅日光灯
    L.rect(0, 22, W, 3, "g4"); L.rect(0, 25, W, PY - 25, "g6"); L.line(0, 25, W, 25, "g7"); // 墙
    L.rect(30, 30, 56, 13, "rd1"); for (let k = 0; k < 5; k++) L.rect(35 + k * 10, 33, 7, 7, "cn5"); // 墙上的红底白字标语牌
    L.ell(240, 37, 10, 10, "cn1"); L.ell(240, 37, 8.5, 8.5, "cn5"); for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; L.px(240 + Math.cos(a) * 7, 37 + Math.sin(a) * 7, "ink"); } L.line(240, 37, 244, 39, "ink"); L.line(240, 37, 237, 32, "ink"); // 挂钟：两点五十
    L.rect(0, PY, W, BY - PY, "pn2");
    for (let i = 0; i < 6; i++) { const x0 = i * 80; L.rect(x0, PY, 2, BY - PY, "pn0"); L.line(x0 + 2, PY, x0 + 2, BY - 1, "pn3"); L.rect(x0 + 22, PY + 3, 36, 5, "pn0"); for (let k = 0; k < 5; k++) L.rect(x0 + 25 + k * 7, PY + 5, 4, 1, "pn4"); } // 盘缝、盘名牌
    L.rect(0, PY - 3, W, 3, "pn1"); L.line(0, PY - 3, W, PY - 3, "pn3"); // 盘顶
    ctTiles(L, 0, 3); ctLamps(L, 10, PY + 68, 9, CT_LAMP);
    for (let k = 0; k < 4; k++) { L.ell(98 + k * 15, PY + 64, 3.5, 3.5, "ink"); L.line(98 + k * 15, PY + 64, 98 + k * 15 + 2, PY + 61, "white"); }
    ctTiles(L, 2, 2); ctLamps(L, 170, PY + 72, 9, i => (i === 4 ? "am3" : null));
    L.rect(326, PY + 10, 68, 40, "pn1"); L.rect(334, PY + 16, 20, 24, mix("pn1", "ck1", 0.4)); L.path([334, PY + 16, 354, PY + 16, 354, PY + 40, 334, PY + 40, 334, PY + 16], "ck3"); L.rect(341, PY + 33, 6, 5, "ck4"); // 模拟图：水池
    L.path([354, PY + 22, 368, PY + 22, 368, PY + 30, 384, PY + 30], "pn4"); L.path([354, PY + 36, 376, PY + 36, 376, PY + 44], "pn4"); L.ell(368, PY + 26, 3, 3, "pn4"); L.rect(380, PY + 26, 8, 9, "pn4"); // 管线、泵、换热器
    for (const [x, y, c] of [[361, PY + 19, "jade"], [372, PY + 33, "jade"], [376, PY + 46, "rd2"]]) { L.rect(x - 1, y - 1, 4, 4, "pn0"); L.rect(x, y, 2, 2, c); }
    ctTiles(L, 5, 3); ctLamps(L, 404, PY + 76, 9, CT_LAMP);
    for (let k = 0; k < 2; k++) { const bx = 120 + k * 240; L.rect(bx - 5, PY - 7, 10, 4, "pn0"); L.ell(bx, PY - 8, 4, 3, "rd0"); L.line(bx - 2, PY - 10, bx, PY - 10, "rd1"); } // 两个警报旋转灯（平时不亮）
    ctFaces(L, "day", 0);
    // 斜面操作台
    L.poly([0, BY, W, BY, W, BY + 13, 0, BY + 13], "pn3"); L.line(0, BY, W, BY, "pn4"); L.line(0, BY + 13, W, BY + 13, "pn0");
    for (let x = 8; x < W - 4; x += 12) { L.rect(x, BY + 6, 4, 3, "ink"); L.px(x + 1, BY + 6, "pn4"); L.rect(x + 1, BY + 2, 2, 2, (x / 12) % 5 === 1 ? "jade" : (x / 12) % 9 === 4 ? "rd2" : "pn1"); } // 开关 + 上面的小灯
    L.rect(0, BY + 14, W, FY - BY - 14, "pn1"); for (let x = 40; x < W; x += 80) { L.line(x, BY + 16, x, FY - 5, "pn0"); L.rect(x - 7, BY + 26, 3, 6, "pn3"); L.rect(x + 5, BY + 26, 3, 6, "pn3"); } L.rect(0, FY - 4, W, 4, "pn0"); // 柜门、踢脚
    // 地面：水磨石，竖缝收向 (240, 96)
    L.vgrad(0, FY, W, H - FY, ["g4", "g3"]);
    for (let k = -14; k <= 14; k++) { const xb = 240 + k * 34; L.line(240 + (xb - 240) * (FY - 96) / (H - 96), FY, xb, H, "g3"); }
    for (let z = 1.25; ; z *= 1.25) { const y = 96 + (H - 96) / z; if (y <= FY + 2) break; L.line(0, y, W, y, "g3"); }
    // 值班桌：木桌面、抽屉；上面转盘电话、交接班记录、搪瓷缸
    L.poly([398, 178, W, 178, W, 188, 390, 188], "woodL"); L.line(390, 188, W, 188, "woodD"); L.rect(390, 189, W - 390, H - 189, "woodD"); L.line(436, 189, 436, H, "brownD"); L.rect(452, 200, 12, 3, "brownD");
    L.poly([402, 179, 428, 179, 426, 185, 398, 185], "paper"); for (let y = 181; y < 185; y += 2) L.line(402, y, 424, y, "cn4"); L.line(414, 179, 412, 185, "cn3"); // 摊开的交接班记录
    L.poly([432, 186, 458, 186, 454, 175, 436, 175], "ink"); L.ell(445, 180, 5.5, 3.6, "cn1"); L.ell(445, 180, 4, 2.6, "cn4"); for (let k = 0; k < 8; k++) { const a = Math.PI * (0.2 + k * 0.2); L.px(445 + Math.cos(a) * 3, 180 + Math.sin(a) * 2, "cn1"); } // 电话机身 + 转盘
    L.rect(432, 170, 26, 3, "ink"); L.ell(434, 171, 4, 3, "ink"); L.ell(456, 171, 4, 3, "ink"); L.line(432, 169, 456, 169, "cn2"); L.path([432, 183, 426, 186, 428, 190, 424, 193], "ink"); // 听筒、电话线
    L.rect(466, 172, 9, 13, "cn5"); L.rect(466, 172, 9, 2, "rd1"); L.ell(476, 178, 2, 3, "cn4"); L.rect(468, 176, 4, 4, "rd1"); // 搪瓷缸
  }
  function controlLit(L, tod) {
    if (tod === "day") return;
    const ls = [{ x: 240, y: 96, r: 300, ry: 80, k: 0.24, c: "mfN" }, { x: 445, y: 174, r: 60, ry: 26, k: 0.2, c: "am1" }];
    for (const [bay, r, c, cc] of CT_LIT) { const [x, y] = tileXY(bay, r, c); ls.push({ x: x + 5, y: y + 3, r: 48, ry: 36, k: 0.9, c: cc === "rd2" ? "rd1" : "am2", p: 1.6 }); }
    for (const [x, y, r] of [[18, 100, 18], [40, 100, 18], [62, 100, 18], [120, 82, 40], [200, 77, 40], [280, 80, 34], [440, 107, 40]]) ls.push({ x, y, r, ry: r * 0.8, k: 0.45, c: "mfN", p: 1.4 });
    lightPass(L, tod === "dawn" ? [0.2, 0.25, 0.28] : [0.15, 0.2, 0.21], ls);
    ctFaces(L, tod, 0);
    for (const [bay, r, c, cc] of CT_LIT) { const [x, y] = tileXY(bay, r, c); L.rect(x, y, 10, 7, cc); L.rect(x + 2, y + 3, 6, 1, cc === "rd2" ? "rd1" : "am2"); bloom(L, x + 5, y + 3, 14, 10, cc, 0.4); bloom(L, x + 5, CT.FY + 14, 8, 12, cc === "rd2" ? "rd1" : "am1", 0.35); } // 光字牌 + 地上的倒影
    for (const [x0, y0, n] of [[10, CT.PY + 68, 9], [404, CT.PY + 76, 9]]) for (let i = 0; i < n; i++) { const c = CT_LAMP(i); if (c) { L.rect(x0 + i * 7, y0, 3, 3, c); bloom(L, x0 + i * 7 + 1.5, y0 + 1.5, 5, 5, c, 0.4); } }
    for (let x = 8; x < W - 4; x += 12) { const c = (x / 12) % 5 === 1 ? "jade" : (x / 12) % 9 === 4 ? "rd2" : null; if (c) L.rect(x + 1, CT.BY + 2, 2, 2, c); }
  }

  /* ---------- 堆厅回廊：从二层回廊的栏杆往下看水池 ----------
   * 世界坐标（米）：池口 x ±5、y 0..8，池深 9；堆芯在池底 (0, 6)；运行桥横跨池子 y≈6，控制棒传动轴从桥上垂到堆芯
   * 相机在回廊上（y −2.5、高 7.5），往下俯 35°。水下那一层（池壁、池底、堆芯、发的蓝光）单独画成自发光，不吃 lightPass */
  const HP = persp(240, 64, 140, 0, -2.5, 7.5, (35 * Math.PI) / 180);
  function hallBase(L, tod, low) {
    const P = HP, night = tod !== "day", wl = low ? -3.2 : -0.3, Q = pts => flat(P, pts);
    // 远墙、侧墙、操作层地面
    L.rect(0, 0, W, H, "cn3");
    L.poly(Q([[-16, 14, 0], [16, 14, 0], [16, 14, 9], [-16, 14, 9]]), "cn4");
    L.poly(Q([[-16, 14, 0], [16, 14, 0], [16, 14, 1.2], [-16, 14, 1.2]]), "g5");
    for (const sx of [-1, 1]) { L.poly(Q([[sx * 16, 14, 0], [sx * 16, 14, 9], [sx * 16, 2, 9], [sx * 16, 2, 0]]), "cn3"); L.poly(Q([[sx * 16, 14, 0], [sx * 16, 14, 1.2], [sx * 16, 2, 1.2], [sx * 16, 2, 0]]), "g4"); }
    for (const x of [-12, -6, 6, 12]) { L.poly(Q([[x - 0.35, 14, 0], [x + 0.35, 14, 0], [x + 0.35, 14, 9], [x - 0.35, 14, 9]]), "cn5"); L.poly(Q([[x + 0.25, 14, 0], [x + 0.35, 14, 0], [x + 0.35, 14, 9], [x + 0.25, 14, 9]]), "cn2"); } // 壁柱
    L.poly(Q([[-10, 14, 0], [-6.8, 14, 0], [-6.8, 14, 2.5], [-10, 14, 2.5]]), "cn2"); for (const x of [-9.2, -8.4, -7.6]) seg(L, P, [x, 14, 0], [x, 14, 2.5], "cn1"); // 大推拉门
    { const [x, y] = P(-8.4, 14, 3.05); L.poly([x - 5, y + 4, x + 5, y + 4, x, y - 5], "hz"); L.ell(x, y + 1, 1.5, 1.5, "ink"); } // 门上的电离辐射标志
    L.poly(Q([[3.6, 14, 0.7], [4.6, 14, 0.7], [4.6, 14, 1.7], [3.6, 14, 1.7]]), "rd1"); // 消防栓箱
    L.poly(Q([[-16, 13.6, 2.6], [16, 13.6, 2.6], [16, 13.6, 2.85], [-16, 13.6, 2.85]]), "cn2"); // 远处的回廊
    for (let x = -15; x <= 15; x += 1.5) seg(L, P, [x, 13.6, 2.85], [x, 13.6, 3.8], "cn2"); seg(L, P, [-16, 13.6, 3.8], [16, 13.6, 3.8], "cn2"); seg(L, P, [-16, 13.6, 3.3], [16, 13.6, 3.3], "cn2");
    L.poly(Q([[-16, 14, 3.9], [16, 14, 3.9], [16, 14, 9], [-16, 14, 9]]), night ? "cn3" : "cn4");
    for (const x0 of [-11, -5, 1, 7]) L.poly(Q([[x0, 14, 4.0], [x0 + 4, 14, 4.0], [x0 + 4, 14, 9], [x0, 14, 9]]), tod === "night" ? "ck0" : tod === "dawn" ? "dn2" : "skyL"); // 高窗
    // 地面分格 + 池边的黄线
    for (let x = -16; x <= 16; x += 2) seg(L, P, [x, 2, 0], [x, 14, 0], "cn2");
    for (let y = 2; y <= 14; y += 2) seg(L, P, [-16, y, 0], [16, y, 0], "cn2");
    for (const d of [0.7, 0.8]) L.path(Q([[-5 - d, -d, 0], [5 + d, -d, 0], [5 + d, 8 + d, 0], [-5 - d, 8 + d, 0], [-5 - d, -d, 0]]), "hz");
    L.poly(Q([[-14, 13.3, 0], [-11.5, 13.3, 0], [-11.5, 13.3, 2.0], [-14, 13.3, 2.0]]), "g5"); L.poly(Q([[-14, 13.3, 2.0], [-11.5, 13.3, 2.0], [-11.5, 14, 2.0], [-14, 14, 2.0]]), "g6"); // 工具柜
    L.poly(Q([[8, 11, 0], [10.5, 11, 0], [10.5, 11, 0.9], [8, 11, 0.9]]), "cn2"); L.poly(Q([[8, 11, 0.9], [10.5, 11, 0.9], [10.5, 12.2, 0.9], [8, 12.2, 0.9]]), "cn4"); // 铅砖车
    // 池口：池壁露在水面以上的一圈（低水位时露得多、湿的）
    const rim = Q([[-5, 0, 0], [5, 0, 0], [5, 8, 0], [-5, 8, 0]]), inRim = inPoly(rim);
    const band = (pts, c) => L.poly(Q(pts), c, 1, inRim), K = keepPen(L, inRim);
    const dry = "cn5", wet = mix("cn4", "ck2", 0.35);
    band([[-5, 8, 0], [5, 8, 0], [5, 8, wl], [-5, 8, wl]], dry); band([[-5, 0, 0], [-5, 8, 0], [-5, 8, wl], [-5, 0, wl]], mix(dry, "cn3", 0.4)); band([[5, 0, 0], [5, 8, 0], [5, 8, wl], [5, 0, wl]], mix(dry, "cn3", 0.2));
    if (low) { // 原来的水位线以下是湿的：深一档，有往下淌的水痕；原水位那里一道锈黄的水垢线
      band([[-5, 8, -0.3], [5, 8, -0.3], [5, 8, wl], [-5, 8, wl]], wet); band([[-5, 0, -0.3], [-5, 8, -0.3], [-5, 8, wl], [-5, 0, wl]], mix(wet, "ink", 0.2)); band([[5, 0, -0.3], [5, 8, -0.3], [5, 8, wl], [5, 0, wl]], mix(wet, "ink", 0.1));
      for (let i = 0; i < 26; i++) { const x = -4.8 + hsh(i) * 9.6, z1 = -0.3 - 0.4 - hsh(i, 2) * 2.4; seg(K, P, [x, 8, -0.3], [x, 8, Math.max(wl, z1)], mix(wet, "ink", 0.35)); }
      for (let i = 0; i < 40; i++) { const y = 0.2 + hsh(i, 3) * 7.6, z1 = -0.5 - hsh(i, 4) * 2.8; for (const sx of [-5, 5]) { seg(K, P, [sx, y, -0.3], [sx, y, Math.max(wl, z1)], mix(wet, "ink", 0.45)); if (i % 3 === 0) seg(K, P, [sx, y + 0.06, -0.5], [sx, y + 0.06, Math.max(wl, z1 + 0.6)], "ck4"); } } // 往下淌的水痕，几道反着光
      for (const [a, c] of [[-0.3, "rs2"], [-0.38, "rs1"]]) { seg(K, P, [-5, 8, a], [5, 8, a], c); seg(K, P, [-5, 0, a], [-5, 8, a], c); seg(K, P, [5, 0, a], [5, 8, a], c); }
    }
    for (const sx of [-5, 5]) for (let z = -0.5; z >= wl; z -= 0.5) seg(K, P, [sx, 0.2, z], [sx, 7.8, z], Math.abs(z % 1) < 0.01 ? "rd1" : mix(dry, "rd1", 0.45)); // 水位刻度线：两侧池壁上每半米一道，整米红
    for (const sx of [-5, 5]) { L.poly(Q([[sx, 1.2, 0], [sx, 1.38, 0], [sx, 1.38, wl], [sx, 1.2, wl]]), "white", 1, inRim); for (let z = -0.25; z > wl; z -= 0.25) seg(K, P, [sx, 1.2, z], [sx, Math.abs(z % 1) < 0.01 ? 1.7 : 1.38, z], "ink"); } // 近处的竖标尺
    // 池沿：一圈钢包边
    for (const [a, b2, c] of [[[-5.3, -0.3], [5.3, -0.3], "cn4"], [[5.3, -0.3], [5.3, 8.3], "cn4"], [[5.3, 8.3], [-5.3, 8.3], "cn5"], [[-5.3, 8.3], [-5.3, -0.3], "cn4"]]) {
      const ins = [[a[0] * 5 / 5.3, a[1] === -0.3 ? 0 : 8], [b2[0] * 5 / 5.3, b2[1] === -0.3 ? 0 : 8]];
      L.poly(Q([[a[0], a[1], 0], [b2[0], b2[1], 0], [ins[1][0], ins[1][1], 0], [ins[0][0], ins[0][1], 0]]), c);
    }
    L.path(Q([[-5, 0, 0], [5, 0, 0], [5, 8, 0], [-5, 8, 0], [-5, 0, 0]]), "cn2");
    L.rim = rim; L.wq = Q([[-5, 0, wl], [5, 0, wl], [5, 8, wl], [-5, 8, wl]]); L.wl = wl;
  }
  // 水下：池壁、池底、堆芯（自发光的蓝），按水面那块贴上去。水越深越看不清：瓷砖缝只画到水下三米多，再往下是一片蓝，堆芯的光把周围照亮
  function hallWater(wl) {
    const U = new PB(W, H), P = HP, Q = pts => flat(P, pts);
    U.rect(0, 0, W, H, "ck1");
    const fog = z => Math.min(1, Math.max(0, (wl - z) / 4.5)), wallC = (z, k) => mix(mix("ck3", "ck2", 0.35), mix("ck1", "ck0", 0.35), fog(z) ** 0.8 * k + (1 - k) * 0.25);
    for (let z = wl; z > -9; z -= 0.25) { const z1 = Math.max(-9, z - 0.25); U.poly(Q([[-5, 8, z], [5, 8, z], [5, 8, z1], [-5, 8, z1]]), wallC(z, 1)); U.poly(Q([[-5, 0, z], [-5, 8, z], [-5, 8, z1], [-5, 0, z1]]), mix(wallC(z, 1), "ck0", 0.25)); U.poly(Q([[5, 0, z], [5, 8, z], [5, 8, z1], [5, 0, z1]]), mix(wallC(z, 1), "ck0", 0.12)); }
    const line = z => mix(wallC(z, 1), "ck0", 0.4 * (1 - fog(z)));
    for (let z = Math.floor(wl * 2) / 2; z > wl - 3.6; z -= 0.5) { const c = line(z); seg(U, P, [-5, 8, z], [5, 8, z], c); seg(U, P, [-5, 0, z], [-5, 8, z], c); seg(U, P, [5, 0, z], [5, 8, z], c); }
    for (let x = -4; x <= 4; x += 1) seg(U, P, [x, 8, wl], [x, 8, wl - 3], line(wl - 1.5)); for (let y = 1; y < 8; y += 1) for (const sx of [-5, 5]) seg(U, P, [sx, y, wl], [sx, y, wl - 3], line(wl - 1.5));
    for (let z = Math.ceil(wl * 2) / 2 - 0.5; z > wl - 3.6; z -= 0.5) for (const sx of [-5, 5]) seg(U, P, [sx, 0.2, z], [sx, 7.8, z], mix(wallC(z, 1), "rd1", 0.55 * (1 - fog(z)))); // 刻度线在水下也看得见，越深越淡
    U.poly(Q([[-5, 0, -9], [5, 0, -9], [5, 8, -9], [-5, 8, -9]]), mix("ck1", "ck0", 0.4)); // 池底：几乎看不见
    const [cx, cy] = P(0, 6, -8.6);
    bloom(U, cx, cy, 200, 120, "ck2", 0.6, 5, 1.1); bloom(U, cx, cy, 90, 52, "ck3", 0.6, 4, 1.3); // 堆芯的光把四周的水照亮
    U.poly(Q([[-1.7, 4.3, -9], [1.7, 4.3, -9], [1.7, 7.7, -9], [-1.7, 7.7, -9]]), "ck2"); // 反射层
    U.poly(Q([[-1.1, 4.9, -8.4], [1.1, 4.9, -8.4], [1.1, 4.9, -9], [-1.1, 4.9, -9]]), "ck3"); // 堆芯前面
    U.poly(Q([[-1.1, 4.9, -8.4], [1.1, 4.9, -8.4], [1.1, 7.1, -8.4], [-1.1, 7.1, -8.4]]), "ck5"); // 堆芯顶面：格架缝里最亮
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { const x = -1.05 + i * 0.43, y = 4.95 + j * 0.43, rod = (i === 1 || i === 3) && (j === 1 || j === 3); U.poly(Q([[x, y, -8.4], [x + 0.36, y, -8.4], [x + 0.36, y + 0.36, -8.4], [x, y + 0.36, -8.4]]), rod ? "ck2" : "ck4"); }
    bloom(U, cx, cy, 34, 20, "ck4", 0.55, 3, 1.2); bloom(U, cx, cy, 14, 8, "ck5", 0.5, 2, 1);
    for (const x of [-0.45, 0.45]) for (const y of [5.6, 6.4]) seg(U, P, [x, y, -8.4], [x, y, wl], mix("ck1", "ck0", 0.5)); // 控制棒传动轴的水下段
    U.touch(); return U;
  }
  function hallFront(L, tod, wl) { // 打完光之后画的近处东西：运行桥、水面以上的传动轴、吊钩、栏杆（自己定颜色：夜里是蓝光里的剪影）
    const P = HP, Q = pts => flat(P, pts), night = tod !== "day";
    const dk = night ? "g1" : "cn2", md = night ? "g2" : "cn3", rimC = night ? "ck2" : "cn5", lt = night ? "g4" : "cn4";
    for (const x of [-0.45, 0.45]) for (const y of [5.6, 6.4]) seg(L, P, [x, y, wl], [x, y, 0.7], dk);
    for (const sx of [-6, 6]) L.poly(Q([[sx - 0.15, -0.5, 0], [sx + 0.15, -0.5, 0], [sx + 0.15, 9, 0], [sx - 0.15, 9, 0]]), dk); // 桥的轨道
    L.poly(Q([[-6.3, 5.4, 0.6], [6.3, 5.4, 0.6], [6.3, 5.4, 0.95], [-6.3, 5.4, 0.95]]), md); L.poly(Q([[-6.3, 5.4, 0.95], [6.3, 5.4, 0.95], [6.3, 6.6, 0.95], [-6.3, 6.6, 0.95]]), lt);
    seg(L, P, [-6.3, 5.4, 0.6], [6.3, 5.4, 0.6], rimC); // 桥下沿：被池子的光从下面照亮
    for (const x of [-0.75, -0.25, 0.25]) L.poly(Q([[x, 5.9, 0.95], [x + 0.4, 5.9, 0.95], [x + 0.4, 5.9, 1.9], [x, 5.9, 1.9]]), md); // 传动机构
    for (let x = -6; x <= 6; x += 1.5) seg(L, P, [x, 5.4, 0.95], [x, 5.4, 1.9], dk); seg(L, P, [-6.3, 5.4, 1.9], [6.3, 5.4, 1.9], dk); seg(L, P, [-6.3, 5.4, 1.45], [6.3, 5.4, 1.45], dk);
    // 天车大梁 + 吊钩
    L.rect(0, 0, W, 9, night ? "g1" : "am1"); L.rect(0, 9, W, 3, night ? "g0" : "am0"); for (let x = -8; x < W; x += 16) { L.line(x, 0, x + 8, 9, night ? "g2" : "hz"); L.line(x + 8, 9, x + 16, 0, night ? "g2" : "hz"); }
    L.line(318, 12, 318, 44, dk); L.line(322, 12, 322, 44, dk); L.rect(314, 44, 12, 9, md); L.line(314, 52, 325, 52, rimC); L.path([320, 53, 320, 58, 323, 61, 326, 58], dk);
    // 近处栏杆：上横杆、中横杆、立柱（黄漆，夜里是剪影、上沿一道蓝）
    const rc = night ? "g2" : "am1", rd = night ? "g0" : "am0", rt = night ? mix("g4", "ck2", 0.4) : "hz";
    for (const [y, h] of [[172, 5], [198, 4]]) { L.rect(0, y, W, h, rc); L.line(0, y, W, y, rt); L.line(0, y + h - 1, W, y + h - 1, rd); }
    for (const x of [26, 186, 346]) { L.rect(x, 172, 5, H - 172, rc); L.line(x, 172, x, H, rt); L.line(x + 4, 172, x + 4, H, rd); }
    L.rect(0, 226, W, H - 226, night ? "g1" : "cn2"); L.line(0, 226, W, 226, rt); // 回廊的踢脚板
  }
  function hallLit(L, tod) {
    const P = HP, [cx, cy] = P(0, 5, -3), lamps = [P(-3, 14, 2.2), P(3, 14, 2.2)], exit = P(9, 14, 2.3);
    if (tod !== "day") lightPass(L, tod === "dawn" ? [0.22, 0.26, 0.32] : [0.13, 0.17, 0.22], [
      { x: cx, y: cy, r: 330, ry: 175, k: 1.25, c: "ck3", p: 1.2, steps: 5 }, { x: cx, y: cy, r: 150, ry: 70, k: 0.6, c: "ck4", p: 1.4 },
      ...lamps.map(([x, y]) => ({ x, y, r: 28, ry: 20, k: 0.9, c: "am2" })), { x: exit[0], y: exit[1], r: 16, k: 0.6, c: "jade" },
      ...(tod === "dawn" ? [{ x: 240, y: 0, r: 420, ry: 60, k: 0.35, c: "dn3" }] : []),
    ]);
    for (const [x, y] of lamps) { L.rect(x - 1, y - 1, 3, 2, tod === "day" ? "cn5" : "am4"); if (tod !== "day") bloom(L, x, y, 7, 5, "am3", 0.5); }
    L.rect(exit[0] - 3, exit[1] - 1, 6, 3, "jade"); L.px(exit[0] - 1, exit[1], "white");
  }
  function hallBuild(tod, low) {
    return baked("hall:" + tod + ":" + (low ? 1 : 0), L => {
      hallBase(L, tod, low); hallLit(L, tod);
      const U = hallWater(L.wl), inR = inPoly(L.rim), inW = inPoly(L.wq);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inR(x, y) && inW(x, y)) { const i = (y * W + x) * 4; L.d[i] = U.d[i]; L.d[i + 1] = U.d[i + 1]; L.d[i + 2] = U.d[i + 2]; }
      const [cx, cy] = HP(0, 6, -6);
      if (tod !== "day") bloom(L, cx, cy - 6, 150, 70, "ck2", 0.22, 3, 1.1, (x, y) => !(inR(x, y) && inW(x, y))); // 水面上方的一层蓝雾
      hallFront(L, tod, L.wl);
      L.inWater = (x, y) => inR(x, y) && inW(x, y);
    });
  }

  const SCENES = {
    control: { name: "控制室", draw(b, t, o) {
      const tod = todOf(o), alarm = propOf(o, "alarm");
      paste(b, baked("control:" + tod, L => { controlBase(L, tod); controlLit(L, tod); }));
      const night = tod !== "day", face = night ? "mfN" : "paper";
      ctChart(b, 92, CT.PY + 12, 56, 40, t, face); ctChart(b, 412, CT.PY + 44, 56, 26, t + 3, face);
      { const a = (Math.floor(t) / 60) * Math.PI * 2 - Math.PI / 2; b.line(240, 37, 240 + Math.cos(a) * 7, 37 + Math.sin(a) * 7, "rd1"); } // 秒针
      const [bx, by] = tileXY(...CT_BLINK), on = Math.floor(t / 0.8) % 2 === 0 || alarm;
      if (on) { b.rect(bx, by, 10, 7, alarm ? "rd2" : "am3"); if (night) bloom(b, bx + 5, by + 3, 14, 10, alarm ? "rd2" : "am3", 0.4); }
      if (alarm) for (let k = 0; k < 2; k++) { // 警报：两个旋转灯一明一暗地扫
        const x = 120 + k * 240, y = CT.PY - 8, ph = (t * 2.2 + k * 0.5) % 1, lit = ph < 0.5;
        b.ell(x, y, 4, 3, lit ? "rd2" : "rd1"); if (lit) { bloom(b, x, y, 60, 40, "rd1", night ? 0.5 : 0.25, 3, 1.2); b.px(x - 1, y - 1, "rd3"); }
        for (const [bay, r, c] of CT_LIT) if (bay === 2 || (Math.floor(t * 3) % 2 && c > 2)) { const [tx, ty] = tileXY(bay, r, c); b.rect(tx, ty, 10, 7, "rd2"); }
      }
    } },
    hall: { name: "堆厅回廊", draw(b, t, o) {
      const tod = todOf(o), L = hallBuild(tod, propOf(o, "low"));
      paste(b, L);
      for (let i = 0; i < 44; i++) { // 水面的粼光：一小段一小段地闪
        const x = -4.7 + hsh(i) * 9.4, y = 0.3 + hsh(i, 2) * 7.4, [sx, sy] = HP(x + Math.sin(t * 0.7 + i) * 0.15, y, L.wl);
        if (!L.inWater(sx, sy) || Math.sin(t * 1.9 + i * 2.3) < 0.35) continue;
        const len = 2 + Math.round(hsh(i, 3) * 4); b.line(sx, sy, sx + len, sy, hsh(i, 4) > 0.8 ? "ck5" : "ck4");
      }
      if (tod !== "day") for (let i = 0; i < 24; i++) { const x = 120 + hsh(i, 5) * 240, y = 150 - ((t * (3 + hsh(i, 6) * 4) + hsh(i, 7) * 140) % 140); if (bay(x, y) < 0.7) b.px(x + Math.sin(t + i) * 3, y, "ck3"); } // 蓝光里浮着的灰
    } },
  };

  /* ---------- 剂量室：主角的小房间 ----------
   * 左边木板上挂满胶片剂量牌（三个钩子空着：今晚当班的人带走了）；书桌上台灯、摊开的剂量登记簿、读数器、暖水瓶；墙上挂历、文件夹；窗外是夜里的海 */
  const DS = { bx: 22, by: 32, cols: 10, rows: 4, empty: ["1,3", "2,6", "0,8"] };
  function dosimBase(L, tod) {
    const night = tod !== "day";
    L.rect(0, 0, W, 122, "cn5"); L.rect(0, 122, W, 70, "g6"); L.rect(0, 120, W, 3, "g5"); L.line(0, 123, W, 123, "g7"); // 上白下绿的墙裙
    L.rect(0, 7, W, 4, "cn3"); L.line(0, 7, W, 7, "cn4"); for (let x = 60; x < W; x += 140) L.rect(x, 5, 3, 8, "cn2"); // 墙上走的一根管子
    L.rect(0, 188, W, H - 188, "g3"); L.line(0, 188, W, 188, "g2");
    // 剂量牌板
    const { bx, by } = DS, bw = 196, bh = 98;
    L.rect(bx - 3, by - 3, bw + 6, bh + 6, "woodD"); L.rect(bx, by, bw, bh, "wood"); for (let y = by + 9; y < by + bh; y += 11) L.line(bx, y, bx + bw - 1, y, mix("wood", "woodD", 0.35));
    L.rect(bx + 62, by - 17, 72, 12, "paper"); for (let k = 0; k < 6; k++) L.rect(bx + 68 + k * 10, by - 13, 7, 4, "cn3"); L.px(bx + 64, by - 15, "rd1"); L.px(bx + 131, by - 15, "rd1"); // 板上贴的纸
    for (let r = 0; r < DS.rows; r++) for (let c = 0; c < DS.cols; c++) {
      const x = bx + 8 + c * 19, y = by + 5 + r * 24;
      L.rect(x + 5, y, 2, 2, "cn1"); L.rect(x, y + 18, 12, 3, "paper"); L.line(x + 2, y + 19, x + 9, y + 19, "cn3"); // 钉子、名签
      if (DS.empty.includes(r + "," + c)) continue;
      const shell = (r + c) % 3 === 0 ? mix("cn5", "ck3", 0.35) : "cn5";
      L.rect(x, y + 2, 12, 15, shell); L.line(x, y + 16, x + 11, y + 16, "cn3"); L.rect(x + 2, y + 6, 8, 7, "cn2"); L.rect(x + 2, y + 6, 3, 3, "cn3"); L.rect(x + 6, y + 9, 3, 3, "silverM"); L.rect(x + 4, y + 1, 4, 3, "silverD"); // 塑料壳、胶片窗里的几块滤片、夹子
    }
    // 挂历、文件夹
    L.rect(232, 30, 36, 56, "white"); L.rect(232, 30, 36, 22, "ck3"); L.poly([232, 52, 244, 40, 252, 46, 262, 38, 268, 44, 268, 52], "g5"); L.rect(232, 30, 36, 2, "rd1"); L.px(250, 28, "cn1");
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) L.rect(235 + c * 5, 58 + r * 6, 3, 3, c === 5 ? "rd1" : "cn3"); L.rect(253, 69, 7, 7, "rd2"); L.rect(254, 70, 5, 5, "white"); L.rect(255, 71, 3, 3, "cn3"); // 圈了一天
    L.rect(282, 82, 92, 3, "woodD"); for (let i = 0; i < 11; i++) { const c = ["rd1", "navyM", "g5", "am1", "cn3"][i % 5], h = 20 + (i * 7) % 5; L.rect(284 + i * 8, 82 - h, 7, h, c); L.rect(285 + i * 8, 82 - h + 4, 5, 4, "paper"); } // 文件夹
    // 窗：外面是海
    const wx = 386, wy = 26, ww = 80, wh = 78;
    L.rect(wx - 4, wy - 4, ww + 8, wh + 8, "g7"); L.vgrad(wx, wy, ww, wh, tod === "night" ? ["g0", "g1", "sea1", "sea2"] : tod === "dawn" ? ["dn1", "dn2", "dn3", "dn2"] : ["sky", "skyL", "fog", "sea4"]);
    L.line(wx, wy + 46, wx + ww - 1, wy + 46, tod === "night" ? "sea3" : tod === "dawn" ? "dn4" : "fog"); // 海平线
    for (let i = 0; i < 9; i++) L.line(wx + hsh(i) * 60, wy + 50 + i * 3, wx + hsh(i) * 60 + 6 + hsh(i, 2) * 10, wy + 50 + i * 3, tod === "night" ? "sea2" : "dn3");
    L.rect(wx + ww / 2 - 1, wy, 3, wh, "g7"); L.rect(wx, wy + 36, ww, 3, "g7"); L.rect(wx - 6, wy + wh + 3, ww + 12, 4, "g6"); // 窗棂、窗台
    // 书桌
    L.poly([212, 156, W, 156, W, 166, 206, 166], "woodL"); L.line(206, 166, W, 166, "woodD"); L.rect(206, 167, W - 206, H - 167, "wood"); L.line(340, 167, 340, H, "woodD"); for (const x of [262, 410]) L.rect(x, 178, 14, 3, "woodD");
    L.ell(300, 158, 10, 3, "greenD"); L.path([300, 157, 298, 140, 304, 126, 312, 118], "greenD"); L.path([301, 157, 299, 140, 305, 126, 313, 118], "green"); // 台灯：底座、蛇管
    L.poly([308, 108, 328, 108, 340, 124, 298, 124], "green"); L.line(308, 108, 328, 108, "jade"); L.line(298, 124, 340, 124, "greenD"); L.ell(319, 125, 6, 1.5, night ? "am4" : "cn4"); // 灯罩
    L.poly([316, 150, 348, 147, 350, 160, 314, 163], "paper"); L.poly([348, 147, 382, 149, 386, 161, 350, 160], "paper"); L.line(348, 147, 350, 160, "cn3"); // 摊开的剂量登记簿
    for (let k = 0; k < 4; k++) { L.line(318, 152 + k * 3, 347, 149 + k * 3, mix("paper", "ck2", 0.3)); L.line(350, 149 + k * 3, 382, 151 + k * 3, mix("paper", "ck2", 0.3)); }
    L.line(326, 149, 327, 161, mix("paper", "rd1", 0.5)); for (let k = 0; k < 7; k++) L.line(330 + (k % 3) * 5, 151 + k * 1.5, 333 + (k % 3) * 5, 151 + k * 1.5, "navy"); L.line(356, 158, 378, 152, "ink"); L.px(377, 152, "silverM"); // 红竖线、写了几行、一支笔
    L.rect(392, 128, 64, 30, "mapM"); L.rect(392, 124, 64, 4, "mapL"); L.line(392, 157, 455, 157, "mapD"); L.rect(398, 133, 26, 10, "ink"); for (let x = 444; x < 454; x += 2) L.line(x, 145, x, 154, "mapD"); // 读数器：机壳、数码管窗、散热缝
    for (const x of [432, 444]) { L.ell(x, 138, 3, 3, "cn1"); L.px(x, 136, "cn4"); } L.rect(400, 148, 30, 3, "mapD"); L.rect(434, 148, 4, 5, "cn1"); L.px(435, 147, "cn4"); // 旋钮、抽屉口、拨动开关
    L.rect(462, 122, 13, 36, "rd1"); L.rect(464, 116, 9, 6, "cn4"); L.rect(465, 112, 7, 4, "woodL"); L.rect(461, 156, 15, 3, "cn4"); for (const [x, y] of [[465, 130], [470, 136], [466, 144], [471, 150]]) { L.px(x, y, "am3"); L.px(x + 1, y, "white"); } L.line(463, 123, 463, 155, "rd2"); // 暖水瓶（红铁皮、印花）
  }
  function dosimLit(L, tod) {
    const night = tod !== "day";
    if (night) lightPass(L, tod === "dawn" ? [0.25, 0.29, 0.33] : [0.17, 0.21, 0.23], [
      { x: 320, y: 152, r: 200, ry: 92, k: 1.35, c: "am3", p: 1.3, steps: 5 }, { x: 318, y: 104, r: 120, ry: 84, k: 0.45, c: "am2", p: 1.2 },
      { x: 426, y: 70, r: 96, ry: 76, k: tod === "dawn" ? 0.5 : 0.25, c: tod === "dawn" ? "dn3" : "ck3" }, { x: 411, y: 138, r: 16, k: 0.5, c: "rd1" },
    ]);
    const digit = (x, y, segs) => { const S = { a: [0, 0, 3, 1], b: [3, 0, 1, 3], c: [3, 3, 1, 3], d: [0, 6, 3, 1], e: [0, 3, 1, 3], f: [0, 0, 1, 3], g: [0, 3, 3, 1] }; for (const s of segs) { const [dx, dy, w, h] = S[s]; L.rect(x + dx, y + dy, w, h, "rd2"); } };
    digit(401, 135, "abcdef"); L.px(406, 141, "rd2"); digit(408, 135, "abcdefg"); digit(414, 135, "fgbc"); // 0.84
    if (night) { L.ell(319, 125, 6, 1.5, "am4"); bloom(L, 319, 126, 22, 8, "am4", 0.6); bloom(L, 411, 138, 14, 7, "rd2", 0.35); }
    if (tod === "night") for (const [x, y, c] of [[404, 70, "rd2"], [446, 71, "am3"], [452, 71, "am3"]]) L.px(x, y, c); // 窗外远处：烟囱上的红灯、对岸两盏灯
  }

  /* ---------- 气闸走廊：两道厚门之间 ----------
   * 一点透视（宽 2.4 米、高 2.6 米，眼睛高 1.5）：尽头是里门（黄黑警示边框、观察窗、压杆把手、门联锁红灯），近处画面两边是外门的门框
   * 左墙电离辐射标志、手脚沾污监测仪；右墙洗消水池和水龙头；地上黄黑警示线、红色控制线。夜里只亮一盏顶灯 */
  const LKP = (x, y, z) => [240 + (x * 200) / z, 120 - ((y - 1.5) * 200) / z];
  function lockBase(L, tod) {
    const P = LKP, Q = pts => flat(P, pts), Z0 = 0.6, Z1 = 4.2;
    L.rect(0, 0, W, H, "cn3");
    L.poly(Q([[-1.2, 2.6, Z0], [1.2, 2.6, Z0], [1.2, 2.6, Z1], [-1.2, 2.6, Z1]]), "cn3");
    for (const sx of [-1.2, 1.2]) { L.poly(Q([[sx, 0, Z0], [sx, 0, Z1], [sx, 2.6, Z1], [sx, 2.6, Z0]]), "cn4"); L.poly(Q([[sx, 0, Z0], [sx, 0, Z1], [sx, 1.2, Z1], [sx, 1.2, Z0]]), "g5"); seg(L, P, [sx, 1.2, Z0], [sx, 1.2, Z1], "g4"); seg(L, P, [sx, 1.23, Z0], [sx, 1.23, Z1], "g4"); }
    for (const z of [1.4, 2.4, 3.4]) for (const sx of [-1.2, 1.2]) seg(L, P, [sx, 1.24, z], [sx, 2.6, z], "cn3"); // 墙板缝
    for (const sx of [-1.12, 1.12]) for (const d of [0, 0.05]) seg(L, P, [sx, 2.5 - d, Z0], [sx, 2.5 - d, Z1], "cn2"); // 顶角走的线管
    L.poly(Q([[-1.2, 0, Z0], [1.2, 0, Z0], [1.2, 0, Z1], [-1.2, 0, Z1]]), "cn2");
    for (let x = -0.8; x <= 0.81; x += 0.4) seg(L, P, [x, 0, Z0], [x, 0, Z1], "cn1"); for (let z = 0.8; z < Z1; z += 0.4) seg(L, P, [-1.2, 0, z], [1.2, 0, z], "cn1");
    for (let y = 121; y < H; y++) { const z = 300 / (y + 0.5 - 120); if (z < Z0 || z > Z1) continue; for (let x = 0; x < W; x++) { const wx = ((x + 0.5 - 240) * z) / 200; if (Math.abs(wx) > 1.2) continue; if (Math.abs(wx) > 1.02 || z > 3.8) L.px(x, y, Math.floor((wx + z) / 0.14) & 1 ? "hz" : "g0"); else if (Math.abs(z - 3.55) < 0.035) L.px(x, y, "rd1"); } } // 黄黑警示线（贴墙、门前）+ 红色控制线
    // 里门
    L.poly(Q([[-1.2, 0, Z1], [1.2, 0, Z1], [1.2, 2.6, Z1], [-1.2, 2.6, Z1]]), "cn4"); L.poly(Q([[-1.2, 0, Z1], [1.2, 0, Z1], [1.2, 1.2, Z1], [-1.2, 1.2, Z1]]), "g5");
    const fo = Q([[-0.72, 0, Z1], [0.72, 0, Z1], [0.72, 2.3, Z1], [-0.72, 2.3, Z1]]), fi = inPoly(Q([[-0.56, 0, Z1], [0.56, 0, Z1], [0.56, 2.12, Z1], [-0.56, 2.12, Z1]]));
    L.poly(fo, "hz"); for (let y = 0; y < H; y++) for (let x = 180; x < 300; x++) if (inPoly(fo)(x, y) && !fi(x, y) && ((x + y) >> 2) & 1) L.px(x, y, "g0"); // 门框：黄黑斜纹
    const leaf = mix("cn3", "ck1", 0.18); L.poly(Q([[-0.56, 0, Z1], [0.56, 0, Z1], [0.56, 2.12, Z1], [-0.56, 2.12, Z1]]), leaf);
    L.path(Q([[-0.46, 0.12, Z1], [0.46, 0.12, Z1], [0.46, 1.25, Z1], [-0.46, 1.25, Z1], [-0.46, 0.12, Z1]]), "cn2"); L.path(Q([[-0.46, 1.32, Z1], [0.46, 1.32, Z1], [0.46, 2.0, Z1], [-0.46, 2.0, Z1], [-0.46, 1.32, Z1]]), "cn2");
    L.poly(Q([[-0.14, 1.45, Z1], [0.14, 1.45, Z1], [0.14, 1.82, Z1], [-0.14, 1.82, Z1]]), "g1"); seg(L, P, [-0.1, 1.5, Z1], [0.02, 1.78, Z1], "g4"); // 观察窗
    for (const y of [0.3, 1.0, 1.75]) L.poly(Q([[-0.6, y, Z1], [-0.5, y, Z1], [-0.5, y + 0.16, Z1], [-0.6, y + 0.16, Z1]]), "cn1"); // 合页
    L.poly(Q([[0.22, 1.02, Z1], [0.48, 1.02, Z1], [0.48, 1.08, Z1], [0.22, 1.08, Z1]]), "cn5"); L.poly(Q([[0.4, 0.98, Z1], [0.5, 0.98, Z1], [0.5, 1.12, Z1], [0.4, 1.12, Z1]]), "cn1"); // 压杆把手
    L.poly(Q([[-0.12, 2.33, Z1], [0.12, 2.33, Z1], [0.12, 2.47, Z1], [-0.12, 2.47, Z1]]), "cn1"); // 门联锁灯的座
    // 左墙：电离辐射标志（黄三角、黑边、三叶）、手脚沾污监测仪
    for (let y = 0; y < 120; y++) for (let x = 20; x < 200; x++) {
      const z = 240 / (240 - x - 0.5), wy = 1.5 - ((y + 0.5 - 120) * z) / 200, u = (z - 1.3) / 0.2, v = (wy - 1.82) / 0.24; // 标志挂在近处（画面最左），别正好在左边站位的人头后面
      if (v < -0.8 || v > 1 || Math.abs(u) > (1 - v) / 1.8) continue;
      let k = v < -0.62 || Math.abs(u) > (1 - v) / 1.8 - 0.2 ? 1 : 0;
      const uu = u / 0.4, vv = (v + 0.12) / 0.4, r = Math.hypot(uu, vv), a = ((Math.atan2(vv, uu) - Math.PI / 2 + Math.PI / 6) % ((2 * Math.PI) / 3) + (2 * Math.PI) / 3) % ((2 * Math.PI) / 3);
      if (r < 0.22 || (r > 0.34 && r < 0.95 && a < Math.PI / 3)) k = 1;
      L.px(x, y, k ? "g0" : "hz");
    }
    L.poly(Q([[-1.2, 0, 2.9], [-0.86, 0, 2.9], [-0.86, 1.7, 2.9], [-1.2, 1.7, 2.9]]), "mapD"); L.poly(Q([[-0.86, 0, 2.9], [-0.86, 0, 3.5], [-0.86, 1.7, 3.5], [-0.86, 1.7, 2.9]]), "mapM"); // 监测仪：迎面一侧、朝走廊一面
    L.poly(Q([[-0.86, 1.3, 2.98], [-0.86, 1.3, 3.42], [-0.86, 1.58, 3.42], [-0.86, 1.58, 2.98]]), "g1"); for (const z of [3.02, 3.26]) L.poly(Q([[-0.86, 0.95, z], [-0.86, 0.95, z + 0.14], [-0.86, 1.1, z + 0.14], [-0.86, 1.1, z]]), "cn1"); // 显示窗、两个伸手的口
    // 右墙：洗消水池、水龙头、蓝牌子
    L.poly(Q([[1.2, 1.45, 2.15], [1.2, 1.45, 2.55], [1.2, 1.72, 2.55], [1.2, 1.72, 2.15]]), "ck1"); for (const yy of [1.55, 1.63]) seg(L, P, [1.2, yy, 2.22], [1.2, yy, 2.48], "cn5");
    L.poly(Q([[0.78, 0.62, 2.1], [1.2, 0.62, 2.1], [1.2, 0.9, 2.1], [0.78, 0.9, 2.1]]), "cn3"); L.poly(Q([[0.78, 0.62, 2.1], [0.78, 0.62, 2.7], [0.78, 0.9, 2.7], [0.78, 0.9, 2.1]]), "cn4");
    L.poly(Q([[0.78, 0.9, 2.1], [1.2, 0.9, 2.1], [1.2, 0.9, 2.7], [0.78, 0.9, 2.7]]), "cn5"); L.poly(Q([[0.84, 0.9, 2.16], [1.16, 0.9, 2.16], [1.16, 0.9, 2.64], [0.84, 0.9, 2.64]]), "cn2");
    seg(L, P, [1.0, 0.62, 2.4], [1.0, 0.0, 2.4], "cn2"); for (const d of [0, 0.02]) { seg(L, P, [1.2, 1.2 - d, 2.4], [1.0, 1.2 - d, 2.4], "cn5"); seg(L, P, [1.0 - d, 1.2, 2.4], [1.0 - d, 1.07, 2.4], "cn5"); }
    // 顶灯（带护罩）
    for (const z of [2.3, 3.5]) { const [x, y] = P(0, 2.58, z), rx = 44 / z, ry = 16 / z; L.ell(x, y, rx + 1, ry + 1, "cn1"); L.ell(x, y, rx, ry, "cn4"); for (let k = -2; k <= 2; k++) L.line(x + (k * rx) / 2.5, y - ry, x + (k * rx) / 2.5, y + ry, "cn1"); }
    // 近处外门的门框
    for (const [x0, w] of [[0, 20], [W - 20, 20]]) { L.rect(x0, 0, w, H, "cn1"); for (let y = 0; y < H; y++) for (let x = 0; x < 6; x++) { const xx = x0 === 0 ? w - 6 + x : x0 + x; if (((xx + y) >> 2) & 1) L.px(xx, y, "hz"); else L.px(xx, y, "g0"); } L.line(x0 === 0 ? w : x0 - 1, 0, x0 === 0 ? w : x0 - 1, H, "cn3"); }
    L.rect(0, 0, W, 8, "cn1"); L.line(20, 8, W - 21, 8, "cn3");
  }
  function lockLit(L, tod) {
    const P = LKP, night = tod !== "day", [l1x, l1y] = P(0, 2.58, 2.3), [l2x, l2y] = P(0, 2.58, 3.5), [rx, ry] = P(0, 2.4, 4.2), [mx, my] = P(-0.86, 1.62, 3.1);
    if (night) lightPass(L, tod === "dawn" ? [0.24, 0.28, 0.3] : [0.19, 0.23, 0.25], [{ x: l2x, y: l2y + 40, r: 250, ry: 200, k: 1.05, c: "g8", p: 1.1, steps: 5 }, { x: rx, y: ry, r: 54, ry: 40, k: 0.8, c: "rd1" }, { x: mx, y: my, r: 20, k: 0.5, c: "jade" }]);
    for (const [x, y, on] of [[l1x, l1y, !night], [l2x, l2y, true]]) if (on) { const z = y === l1y ? 2.3 : 3.5; L.ell(x, y, 44 / z - 1, 16 / z - 1, "white"); if (night) bloom(L, x, y + 2, 40, 16, "g8", 0.4); }
    L.rect(rx - 3, ry - 2, 6, 4, night ? "rd2" : "rd1"); if (night) bloom(L, rx, ry, 12, 8, "rd2", 0.5);
    L.rect(mx - 1, my - 1, 3, 2, "jade");
  }

  /* ---------- 管沟：地下管廊 ----------
   * 一点透视（宽 1.8、高 1.7，眼睛高 0.9）：两边墙上一排排管子、支架、法兰、一个红阀轮；头顶一根横穿的管子；地上积水，倒映着上面的东西
   * 没有灯，只有手电：光斑随时间晃（每帧打光）。不分时段 */
  const TRP = (x, y, z) => [240 + (x * 210) / z, 112 - ((y - 0.9) * 210) / z], TRM = (x, y, z) => TRP(x, -y, z);
  const TR_PIPES = [[-0.72, 1.32, 0.12, "g5"], [-0.76, 0.9, 0.08, "cn3"], [-0.79, 0.55, 0.06, "rs2"], [0.7, 1.2, 0.15, "mapM"], [0.77, 0.66, 0.07, "rd1"]]; // [x, 高, 半径, 色]
  function trenchWorld(L, P) {
    const Q = pts => flat(P, pts), Z0 = 0.5, Z1 = 7;
    L.poly(Q([[-0.9, 1.7, Z0], [0.9, 1.7, Z0], [0.9, 1.7, Z1], [-0.9, 1.7, Z1]]), "cn1");
    for (const sx of [-0.9, 0.9]) { L.poly(Q([[sx, 0, Z0], [sx, 0, Z1], [sx, 1.7, Z1], [sx, 1.7, Z0]]), "cn2"); for (const y of [0.42, 0.85, 1.28]) seg(L, P, [sx, y, Z0], [sx, y, Z1], "cn1"); }
    for (let z = 1; z < Z1; z += 1) { seg(L, P, [-0.9, 1.7, z], [0.9, 1.7, z], "cn0"); for (const sx of [-0.9, 0.9]) seg(L, P, [sx, 0, z], [sx, 1.7, z], "cn1"); }
    L.poly(Q([[-0.9, 0, Z1], [0.9, 0, Z1], [0.9, 1.7, Z1], [-0.9, 1.7, Z1]]), "g0"); // 尽头：黑的，管沟还往里拐
    for (let i = 0; i < 16; i++) { const sx = i % 2 ? 0.9 : -0.9, z = 0.8 + hsh(i, 8) * 5.5, w = 0.15 + hsh(i, 9) * 0.35, len = 0.3 + hsh(i, 10) * 0.9; L.poly(Q([[sx, 1.7, z], [sx, 1.7, z + w], [sx, 1.7 - len, z + w * 0.7], [sx, 1.7 - len * 0.8, z + w * 0.2]]), "cn1"); seg(L, P, [sx, 1.7 - len * 0.8, z + w * 0.4], [sx, 0.3 + hsh(i, 11) * 0.4, z + w * 0.4], i % 3 ? "cn1" : "cn4"); } // 渗水的湿印、往下淌的水痕、白的析出物
    for (let z = 1.2; z < Z1; z += 1.2) for (const sx of [-0.88, 0.88]) L.poly(Q([[sx, 0.2, z], [sx, 0.2, z + 0.05], [sx, 1.6, z + 0.05], [sx, 1.6, z]]), "cn0"); // 支架槽钢
    for (const [x, y, r, c] of TR_PIPES) {
      L.poly(Q([[x, y + r, Z0], [x, y + r, Z1], [x, y - r, Z1], [x, y - r, Z0]]), c);
      L.poly(Q([[x, y + r * 0.6, Z0], [x, y + r * 0.6, Z1], [x, y + r * 0.3, Z1], [x, y + r * 0.3, Z0]]), mix(c, "white", 0.3));
      L.poly(Q([[x, y - r * 0.45, Z0], [x, y - r * 0.45, Z1], [x, y - r, Z1], [x, y - r, Z0]]), mix(c, "ink", 0.4));
      for (let z = 1.5 + (x > 0 ? 0.6 : 0); z < Z1; z += 2) { L.poly(Q([[x, y + r + 0.03, z], [x, y + r + 0.03, z + 0.06], [x, y - r - 0.03, z + 0.06], [x, y - r - 0.03, z]]), mix(c, "ink", 0.25)); seg(L, P, [x, y + r + 0.03, z], [x, y - r - 0.03, z], mix(c, "white", 0.25)); }
      for (let z = 0.9; z < Z1; z += 1.1) if (hsh(z * 10 + x * 7) > 0.45) { const zz = z + hsh(z * 3 + x) * 0.5; L.poly(Q([[x, y + r * 0.2, zz], [x, y + r * 0.2, zz + 0.25], [x, y - r * 0.7, zz + 0.3], [x, y - r * 0.6, zz]]), "rs2"); } // 锈斑
    }
    { const [cx, cy] = P(-0.58, 0.9, 3.2), ry = 0.17 * 210 / 3.2, rx = ry * 0.36; L.ell(cx, cy, rx + 1, ry + 1, "rd1"); L.ell(cx, cy, rx - 1, ry - 2, "cn2"); L.line(cx, cy - ry, cx, cy + ry, "rd1"); L.line(cx - rx, cy, cx + rx, cy, "rd1"); L.ell(cx, cy, 1.5, 2, "rs2"); } // 侧墙上的阀轮
    L.poly(Q([[0.55, 1.5, Z0], [0.9, 1.5, Z0], [0.9, 1.5, Z1], [0.55, 1.5, Z1]]), "cn0"); for (const d of [0.62, 0.7, 0.8]) seg(L, P, [d, 1.48, Z0], [d, 1.48, Z1], "g1"); // 电缆桥架
    L.poly(Q([[-0.9, 1.58, 2.7], [0.9, 1.58, 2.7], [0.9, 1.4, 2.7], [-0.9, 1.4, 2.7]]), "cn3"); L.poly(Q([[-0.9, 1.52, 2.7], [0.9, 1.52, 2.7], [0.9, 1.48, 2.7], [-0.9, 1.48, 2.7]]), "cn4"); L.poly(Q([[-0.9, 1.43, 2.7], [0.9, 1.43, 2.7], [0.9, 1.4, 2.7], [-0.9, 1.4, 2.7]]), "cn1"); // 头顶横穿的管子
    { const [x, y] = P(0.15, 1.38, 2.7); L.line(x, y, x, y + 7, "cn1"); L.rect(x - 3, y + 7, 7, 9, "am2"); L.rect(x - 2, y + 9, 5, 1, "am0"); L.rect(x - 2, y + 12, 3, 1, "am0"); } // 挂着的黄色标签
  }
  function trenchBase() {
    return baked("trench", L => {
      L.rect(0, 0, W, H, "cn2"); trenchWorld(L, TRP);
      const M = new PB(W, H); M.rect(0, 0, W, H, "cn1"); trenchWorld(M, TRM);
      const fl = inPoly(flat(TRP, [[-0.9, 0, 0.5], [0.9, 0, 0.5], [0.9, 0, 7], [-0.9, 0, 7]])), wc = col("sea1");
      for (let y = 112; y < H; y++) { const sh = Math.round(Math.sin(y * 0.9) * 1.2); for (let x = 0; x < W; x++) if (fl(x, y)) { const i = (y * W + x) * 4, j = (y * W + Math.min(W - 1, Math.max(0, x + sh))) * 4; for (let q = 0; q < 3; q++) L.d[i + q] = wc[q] * 0.55 + M.d[j + q] * 0.45; } } // 积水：倒影 + 水色，一行行错开一点（水面不平）
      for (let i = 0; i < 40; i++) { const z = 0.7 + hsh(i, 12) * 5, x = -0.8 + hsh(i, 13) * 1.6, [sx, sy] = TRP(x, 0, z); L.line(sx, sy, sx + 2 + 12 / z, sy, "sea2"); } // 水面的细纹
    });
  }

  /* ---------- 码头：研究所背后的小码头 ----------
   * 近处混凝土岸边、两个系缆桩；右边木栈桥伸进海里、桥头一盏钠灯、拴着一条小工作船；左边隔着一湾水是研究所：反应堆厂房、办公楼、红白相间的通风烟囱（顶上航空障碍灯）
   * night：阴天的夜，对岸零星亮灯；sunset（黎明前）：灰蓝的天，海平线一道冷白；day：阴天。室外，下雨整片下 */
  const PR = { HZ: 126 };
  function pierBase(L, tod) {
    const N = tod === "night", D = tod === "dawn", HZ = PR.HZ, T = (n, d, y) => (N ? n : D ? d : y);
    L.vgrad(0, 0, W, HZ, T(["g1", "g2", "g2", "g3"], ["dn0", "dn1", "dn2", "dn3"], ["cn3", "cn4", "cn5", "fog"]));
    if (D) bloom(L, 400, HZ, 260, 34, "dn4", 0.85, 4, 1); if (N) bloom(L, 160, HZ, 200, 40, "am0", 0.4, 3, 1.2); // 黎明：海那边一道冷白；夜里：研究所的灯把低云照出一点暖
    for (let i = 0; i < 9; i++) { // 低云：一条条压着
      const cy = 14 + i * 11 + hsh(i, 20) * 6, cx = hsh(i, 21) * W, len = 120 + hsh(i, 22) * 200, c = T(i % 2 ? "g2" : "g3", i % 2 ? "dn1" : mix("dn1", "dn2", 0.5), i % 2 ? "cn3" : "cn4");
      for (let k = 0; k < 6; k++) L.ell(cx - len / 2 + (k * len) / 5, cy, len / 7, 5 + hsh(i * 7 + k, 23) * 4, c, (x, y) => y < cy + 3);
      if (D) L.line(cx - len / 2, cy + 3, cx + len / 2, cy + 3, "dn3");
    }
    L.poly([0, 98, 30, 93, 70, 99, 120, 95, 170, 101, 230, 105, 290, 114, 330, 123, 330, HZ, 0, HZ], T("g0", "dn1", "g5")); // 后山
    const bld = T("g2", mix("dn1", "dn0", 0.4), "cn4"), bld2 = T("g1", "dn0", "cn3");
    L.rect(92, 74, 58, HZ - 74, bld); L.line(92, 74, 149, 74, T("g3", "dn2", "cn5")); L.rect(104, 70, 10, 4, bld2); L.rect(130, 69, 6, 5, bld2); L.rect(150, 106, 12, HZ - 106, bld2); // 反应堆厂房 + 屋顶设备
    L.rect(162, 94, 84, HZ - 94, bld); L.line(162, 94, 245, 94, T("g3", "dn2", "cn5"));
    for (let r = 0; r < 3; r++) for (let c = 0; c < 11; c++) { const on = hsh(r * 11 + c, 24) > (N ? 0.72 : 0.86); L.rect(166 + c * 7, 99 + r * 8, 4, 4, on && tod !== "day" ? "am3" : T("g1", "dn1", "cn3")); }
    for (const [x, y] of [[100, 84], [138, 84], [116, 104]]) L.rect(x, y, 3, 3, N && x !== 138 ? "am3" : bld2);
    { const red = T("rd0", mix("rd1", "dn1", 0.35), "rd1"), wht = T("g3", "dn3", "cn5"); L.poly([68, HZ, 80, HZ, 77, 28, 71, 28], wht); L.poly([68, HZ, 80, HZ, 77, 28, 71, 28], red, 1, (x, y) => Math.floor((y - 28) / 7) % 2 === 0); }
    L.rect(68, 42, 12, 2, T("g1", "dn0", "cn2")); L.rect(70, 26, 8, 2, T("g1", "dn0", "cn2")); L.line(76, 28, 76, HZ, T("g1", "dn1", "cn3")); // 烟囱：红白相间、平台、背光一侧
    L.rect(0, HZ - 2, 334, 6, T("g0", "dn0", "cn2")); // 对岸的海堤
    L.vgrad(0, HZ + 4, W, H - HZ - 4, T(["sea3", "sea2", "sea1"], ["dn3", "dn2", "sea3", "sea2"], ["cn4", "sea4", "sea3"])); L.rect(334, HZ, W - 334, 4, T("sea2", "dn4", "cn5"));
    for (let i = 0; i < 160; i++) { const y = HZ + 6 + ((i * 37) % 140) * (0.3 + hsh(i, 25) * 0.7), x = hsh(i, 26) * W, len = 3 + (y - HZ) * 0.12 * hsh(i, 27); L.line(x, y, x + len, y, i % 3 ? T("sea3", "dn3", "cn4") : T("sea0", "sea2", "sea2")); } // 浪
    for (const x of [40, 104, 186, 248, 300]) { L.px(x, HZ - 4, tod === "day" ? "cn3" : "am3"); if (tod !== "day") bloom(L, x, HZ - 4, 6, 4, "am2", 0.4); } // 岸边的路灯
    // 近处的岸：混凝土地面、条石岸边
    L.poly([0, 200, 292, 212, 330, H, 0, H], T("g2", "cn1", "cn3")); for (let k = 1; k < 8; k++) L.line(k * 40, 200 + k * 1.6, k * 46 - 30, H, T("g0", "cn0", "cn2")); L.line(0, 222, 300, 236, T("g0", "cn0", "cn2"));
    for (const [x, y, rx] of [[150, 228, 26], [258, 222, 18], [60, 246, 30]]) L.ell(x, y, rx, rx * 0.16, T("sea1", "dn1", "cn4")); // 地上的积水
    L.rect(34, 150, 3, 56, T("g0", "dn0", "cn1")); L.ell(35.5, 168, 11, 11, T("cn3", "dn3", "cn5")); L.ell(35.5, 168, 6, 6, T("g1", "dn1", "cn3")); for (const a of [0.25, 1.85, 3.45, 5.05]) L.ell(35.5 + Math.cos(a) * 8.5, 168 + Math.sin(a) * 8.5, 3, 3, T("rd0", "rd1", "rd1")); L.line(25, 158, 40, 157, T("g4", "dn4", "white")); // 救生圈架
    L.line(0, 200, 292, 212, T("cn3", "cn4", "cn5")); L.line(0, 201, 292, 213, T("cn2", "cn3", "cn4"));
    // 木栈桥：从岸边伸向海里
    const pl = [[296, 213], [404, 150]], pr = [[372, 216], [428, 150]], lerp2 = (a, b2, s) => [a[0] + (b2[0] - a[0]) * s, a[1] + (b2[1] - a[1]) * s];
    for (let k = 0; k < 9; k++) { const s = 1 - 1 / (1 + k * 0.45), s2 = s + 0.05, [x0, y0] = lerp2(pl[0], pl[1], s), [x1] = lerp2(pl[0], pl[1], s2); L.rect(Math.round(x0) - 1, y0, 3, (30 * (1 - s) + 6) | 0, T("g0", "dn0", "woodD")); } // 桩
    L.poly([pl[0][0], pl[0][1], pl[1][0], pl[1][1], pr[1][0], pr[1][1], pr[0][0], pr[0][1]], T("brownD", "woodD", "wood"));
    L.poly([pl[0][0], pl[0][1], pl[1][0], pl[1][1], pl[1][0], pl[1][1] + 2, pl[0][0], pl[0][1] + 5], T("g0", "dn0", "woodD")); // 桥面侧边
    for (let k = 0; k < 40; k++) { const s = 1 - 1 / (1 + k * 0.2), a = lerp2(pl[0], pl[1], s), c2 = lerp2(pr[0], pr[1], s); L.line(a[0], a[1], c2[0], c2[1], T("g1", "woodD", "woodD")); } // 桥板缝
    for (const s of [0.18, 0.62]) { const [x, y] = lerp2(pl[0], pl[1], s), k = 1 - s * 0.6; L.rect(x - 2 * k, y - 6 * k, 5 * k, 6 * k, T("g1", "dn0", "cn1")); L.rect(x - 3 * k, y - 7 * k, 7 * k, 2, T("g2", "dn1", "cn2")); } // 桥上的小系缆桩
    L.poly([430, 172, W, 168, W, 184, 436, 184], T("g1", "dn1", "cn4")); L.poly([446, 160, 470, 160, 470, 170, 446, 170], T("g2", "dn1", "cn5")); L.rect(450, 162, 5, 4, tod === "day" ? "cn3" : T("am3", "dn3", "cn3")); L.line(430, 172, W, 168, T("g3", "dn3", "cn5")); L.path([430, 176, 418, 180, 412, 176], T("g2", "dn2", "cn2")); // 小工作船、缆绳
    for (const [x, y] of [[96, 202], [232, 209]]) { L.ell(x, y + 6, 11, 3, T("g0", "dn0", "cn1")); L.rect(x - 6, y - 8, 12, 14, T("g1", "dn0", "g2")); L.ell(x, y - 8, 9, 3.5, T("g2", "dn1", "g3")); L.line(x - 6, y - 7, x - 6, y + 5, T("g3", "dn2", "g4")); L.line(x - 8, y - 9, x + 3, y - 10, T("g4", "dn3", "g5")); } // 铸铁系缆桩
    L.path([238, 206, 262, 196, 296, 192, 330, 190], T("g2", "dn1", "woodD")); // 拴在桩上的缆绳
    L.line(378, 216, 378, 126, T("g0", "dn0", "cn1")); L.line(379, 216, 379, 126, T("g1", "dn1", "cn2")); L.path([378, 127, 372, 124, 366, 126], T("g0", "dn0", "cn1")); L.rect(362, 126, 9, 4, T("g1", "dn0", "cn1")); // 桥头的路灯杆
    if (tod !== "day") { bloom(L, 372, 208, 120, 40, "am1", N ? 0.7 : 0.4, 4, 1.1); bloom(L, 366, 131, 30, 20, "am2", 0.5); L.rect(363, 130, 7, 2, "am4"); } else L.rect(363, 130, 7, 2, "cn4");
  }

  SCENES.dosim = { name: "剂量室", draw(b, t, o) {
    const tod = todOf(o); paste(b, baked("dosim:" + tod, L => { dosimBase(L, tod); dosimLit(L, tod); }));
  } };
  SCENES.lock = { name: "气闸走廊", draw(b, t, o) {
    const tod = todOf(o); paste(b, baked("lock:" + tod, L => { lockBase(L, tod); lockLit(L, tod); }));
    if (tod !== "day" && Math.sin(t * 23) * Math.sin(t * 7.1) > 0.92) { const [x, y] = LKP(0, 2.58, 3.5); b.ell(x, y, 11, 3.5, "cn4"); } // 夜里那盏灯偶尔一跳
  } };
  SCENES.trench = { name: "管沟", draw(b, t, o) {
    paste(b, trenchBase());
    const sx = 236 + 30 * Math.sin(t * 0.55) + 6 * Math.sin(t * 1.9), sy = 104 + 8 * Math.sin(t * 0.8); // 手电光斑在晃
    lightPass(b, [0.05, 0.06, 0.07], [{ x: sx, y: sy, r: 200, ry: 158, k: 1.9, c: "am4", p: 1.5, steps: 6 }, { x: sx, y: sy, r: 72, ry: 56, k: 0.6, c: "white", p: 1.3 }, { x: 240, y: 285, r: 330, ry: 175, k: 0.45, c: "am3", p: 1.3 }, { x: sx, y: 318 - sy, r: 150, ry: 62, k: 1.2, c: "am4", p: 1.4 }]); // 光斑、中心、近处的散光、水里的倒影
    bloom(b, (sx + 240) / 2, (sy + 290) / 2, 70, 110, "am4", 0.08, 2, 1); // 光柱里的一点雾
    for (let i = 0; i < 18; i++) { const x = sx - 60 + hsh(i, 30) * 120, y = sy - 40 + ((t * 6 * (0.5 + hsh(i, 31)) + hsh(i, 32) * 100) % 100); if (Math.hypot(x - sx, (y - sy) * 1.2) < 70) b.px(x, y, "am4"); } // 灰尘
    for (let i = 0; i < 3; i++) { // 天花板滴下来的水：前半段往下掉，后半段在水面上散开一圈
      const z = 1.6 + i * 1.1, x = [-0.3, 0.25, -0.05][i], ph = (t * 0.6 + i * 0.37) % 1;
      if (ph < 0.5) { const [dx, dy] = TRP(x, 1.7 * (1 - (ph / 0.5) ** 2), z); b.rect(dx, dy, 1, 2, "cn4"); continue; }
      const [cx, cy] = TRP(x, 0, z), r = 1 + ((ph - 0.5) * 2 * 28) / z; for (let a = 0; a < 28; a++) { const q = (a / 28) * Math.PI * 2; b.px(cx + Math.cos(q) * r, cy + Math.sin(q) * r * 0.22, mix("sea3", "am3", 0.5)); }
    }
  } };
  SCENES.pier = { name: "码头", draw(b, t, o) {
    const tod = todOf(o); paste(b, baked("pier:" + tod, L => pierBase(L, tod)));
    const N = tod === "night", D = tod === "dawn";
    if (Math.floor(t / 1.5) % 2 === 0 || (t % 1.5) < 0.35) { b.rect(73, 25, 3, 2, "rd2"); if (tod !== "day") { bloom(b, 74, 26, 8, 6, "rd2", 0.6); for (let y = PR.HZ + 6; y < PR.HZ + 60; y += 3) if (Math.sin(y * 1.7 + t * 3) > 0) b.line(73 + Math.sin(y + t) * 2, y, 75 + Math.sin(y + t) * 2, y, "rd1"); } } // 烟囱顶的障碍灯 + 水里的倒影
    if (tod !== "day") {
      for (let y = 140; y < 206; y += 2) { const w = 2 + (y - 140) * 0.08, x = 366 + Math.sin(y * 0.7 + t * 2.2) * (1 + (y - 140) * 0.05); if (Math.sin(y * 1.3 + t * 4) > -0.2) b.line(x - w, y, x + w, y, (y & 3) ? "am2" : "am3"); } // 桥头灯的倒影
      for (let c = 0; c < 11; c++) if (hsh(c, 24) > (N ? 0.72 : 0.86)) for (let y = PR.HZ + 6; y < PR.HZ + 30; y += 3) if (Math.sin(y * 2 + t * 3 + c) > 0.1) b.line(167 + c * 7, y, 169 + c * 7, y, "am1"); // 办公楼窗户的倒影
    }
    for (let i = 0; i < 30; i++) { const y = PR.HZ + 8 + hsh(i, 40) * 70, x = (hsh(i, 41) * W + t * (4 + hsh(i, 42) * 6)) % W; if (Math.sin(t * 1.3 + i) > 0.6) b.line(x, y, x + 3, y, N ? "sea3" : D ? "dn4" : "white"); } // 粼光
  } };

  /* ---------- 俯看水池（cg_pool、封面共用）----------
   * 相机在水面上方往下看：池壁是一圈圈往下收的矩形（每格瓷砖缝都画），越深越蓝、越亮（离堆芯越近）；池底中间是堆芯：6×6 的燃料格架，缝里最亮
   * 逐像素算：这个点在哪面墙 / 池底、多深 → 颜色；格子编号和右边、下边的邻居不同就是一条缝 */
  function poolShaft(B, vx, vy, R, o = {}) {
    const k = 0.45, s9 = 1 / (1 + 9 * k), ppm = (R.x1 - R.x0) / 12, dark = o.dark || 0;
    const at = (x, y) => {
      const dx = x + 0.5 - vx, dy = y + 0.5 - vy, sx = dx >= 0 ? dx / (R.x1 - vx) : dx / (R.x0 - vx), sy = dy >= 0 ? dy / (R.y1 - vy) : dy / (R.y0 - vy), s = Math.max(sx, sy);
      if (s < s9) return { f: 1, z: 9, a: (dx / s9 - (R.x0 - vx)) / ppm, b: (dy / s9 - (R.y0 - vy)) / ppm };
      if (s > 1) return { deck: 1, f: 0, z: 0, a: 0, side: 9 };
      const z = (1 / s - 1) / k; return sx >= sy ? { f: 0, side: dx < 0 ? 0 : 1, z, a: (dy / s - (R.y0 - vy)) / ppm } : { f: 0, side: dy < 0 ? 2 : 3, z, a: (dx / s - (R.x0 - vx)) / ppm };
    };
    const cell = q => (q.f ? Math.floor(q.a) * 97 + Math.floor(q.b) : q.side * 1e4 + Math.floor(q.z * 2) * 97 + Math.floor(q.a));
    for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) {
      const q = at(x, y), d = Math.min(1, q.z / 9);
      if (q.deck) { B.px(x, y, y < R.y1 + 3 ? "hz" : "g1"); continue; } // 池边（只有 cg 的下沿露一点）
      let c = q.f ? mix("ck1", "ck0", 0.35) : mix(mix("ck0", "ck1", 0.6), mix("ck2", "ck3", 0.3), d ** 1.4);
      if (!q.f && q.side === 2) c = mix(c, "ck0", 0.18); if (!q.f && q.side === 1) c = mix(c, "ck0", 0.1);
      const qr = at(x + 1, y), qd = at(x, y + 1);
      if ((cell(q) !== cell(qr) || cell(q) !== cell(qd)) && qr.f === q.f && qd.f === q.f) c = mix(c, "ck0", (q.f ? 0.25 : 0.55) * (1 - d * 0.6)); // 瓷砖缝，越深越淡
      if (!q.f && q.z < 4 && Math.floor(q.z * 2) !== Math.floor(qd.z * 2) && q.side < 2 && q.a > 2.4 && q.a < 3.0) c = mix(c, "rd1", 0.6 * (1 - d)); // 一侧池壁上的红色水位刻度
      if (dark) c = mix(c, "ck0", dark * (1 - d));
      B.px(x, y, c);
    }
    const proj = (a, b2, z) => { const s = 1 / (1 + z * k); return [vx + (R.x0 - vx + a * ppm) * s, vy + (R.y0 - vy + b2 * ppm) * s]; };
    const quad = (a0, b0, a1, b1, z, c) => B.poly([...proj(a0, b0, z), ...proj(a1, b0, z), ...proj(a1, b1, z), ...proj(a0, b1, z)], c);
    const ca = o.core[0], cb = o.core[1], CS = 2.4 / 2; // 堆芯 2.4 米见方
    for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) { quad(1.5 + i * 0.55, 1.2 + j * 0.55, 1.95 + i * 0.55, 1.65 + j * 0.55, 8.7, (i + j) % 3 ? "ck1" : mix("ck1", "ck2", 0.6)); } // 角上的乏燃料格架，也泛一点蓝
    const [gx, gy] = proj(ca + CS, cb + CS, 8.6);
    bloom(B, gx, gy, o.glow * 1.6, o.glow * 1.4, "ck2", 0.55, 5, 1.1); bloom(B, gx, gy, o.glow * 0.8, o.glow * 0.7, "ck3", 0.6, 4, 1.3);
    quad(ca - 0.5, cb - 0.5, ca + 2.9, cb + 2.9, 9, "ck2"); quad(ca, cb, ca + 2.4, cb + 2.4, 9, "ck3"); quad(ca, cb, ca + 2.4, cb + 2.4, 8.4, "ck5"); // 反射层、堆芯侧面、顶面
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { const a = ca + 0.06 + i * 0.39, b2 = cb + 0.06 + j * 0.39, rod = (i === 1 || i === 4) && (j === 1 || j === 4), edge = i === 0 || j === 0 || i === 5 || j === 5; quad(a, b2, a + 0.32, b2 + 0.32, 8.4, rod ? "ck1" : edge ? "ck3" : "ck4"); }
    bloom(B, gx, gy, o.glow * 0.42, o.glow * 0.38, "ck4", 0.55, 3, 1.2); bloom(B, gx, gy, o.glow * 0.18, o.glow * 0.16, "ck5", 0.6, 2, 1);
    for (const [a, b2] of [[ca + 0.48, cb + 0.48], [ca + 1.62, cb + 0.48], [ca + 0.48, cb + 1.62], [ca + 1.62, cb + 1.62]]) { const p0 = proj(a, b2, 8.3), p1 = proj(a, b2, 0.3); B.poly([p0[0] - 0.5, p0[1], p0[0] + 0.5, p0[1], p1[0] + 1.5, p1[1], p1[0] - 1.5, p1[1]], mix("ck0", "ck1", 0.45)); } // 控制棒传动轴：竖着从堆芯伸上来，透视里像从堆芯往外放射
    B.touch(); return proj;
  }
  const waterWobble = (b, U, t, a = 1) => { for (let y = 0; y < H; y++) { const dx = Math.round(a * (1.2 * Math.sin(y * 0.11 + t * 1.8))); for (let x = 0; x < W; x++) { const sx = Math.min(W - 1, Math.max(0, x + dx + Math.round(a * 0.8 * Math.sin(x * 0.05 + t * 1.1)))), sy = Math.min(H - 1, Math.max(0, y + Math.round(a * 0.8 * Math.sin(x * 0.09 + t * 1.4)))), i = (y * W + x) * 4, j = (sy * W + sx) * 4; b.d[i] = U.d[j]; b.d[i + 1] = U.d[j + 1]; b.d[i + 2] = U.d[j + 2]; b.d[i + 3] = 255; } } b.touch(); };
  const sparkles = (b, t, n, area, c1, c2) => { for (let i = 0; i < n; i++) { const x = area[0] + hsh(i, 50) * area[2] + Math.sin(t * 0.5 + i) * 6, y = area[1] + hsh(i, 51) * area[3]; if (Math.sin(t * 2.3 + i * 1.7) > 0.45) b.line(x, y, x + 2 + (i % 4), y, i % 5 ? c1 : c2); } };

  // cg_pool：手套扶着栏杆，往下看九米深的水
  function cgPoolFront() {
    return baked("cg_pool:front", F => {
      F.d.fill(0); F.bx0 = W; F.by0 = H; F.bx1 = -1; F.by1 = -1;
      const u = [0.9958, -0.0916], n = [-0.0916, -0.9958], R0 = [-10, 196], at = (t, b2) => [R0[0] + u[0] * t + n[0] * b2, R0[1] + u[1] * t + n[1] * b2];
      const band = (b0, b1, c) => F.poly([...at(-20, b0), ...at(560, b0), ...at(560, b1), ...at(-20, b1)], c);
      band(-7, 7, "am0"); band(-3, 4, "am1"); band(4, 5.5, "am1"); band(5.5, 7, mix("am1", "ck3", 0.6)); band(-7, -5.5, "g0"); // 栏杆：黄漆钢管，下面一面被水里的光照亮
      F.poly([...at(52, -6), ...at(62, -6), ...at(78, -120), ...at(68, -120)], "am0"); F.line(...at(62, -6), ...at(78, -120), mix("am1", "ck3", 0.4)); // 立柱
      const C = [190, 178], L = (a, b2) => [C[0] + u[0] * a + n[0] * b2, C[1] + u[1] * a + n[1] * b2], poly = (pts, c) => F.poly(pts.flatMap(([a, b2]) => L(a, b2)), c);
      const sl = "stD", gD = mix("gvD", "ink", 0.35), gM = "gvD", gL = mix("gvM", "gvD", 0.3), rimC = mix("gvM", "ck4", 0.55);
      { const a = L(2, -22), b2 = L(32, -18), sc = [mix(sl, "ink", 0.5), mix(sl, "ink", 0.3), mix(sl, "ck2", 0.35)]; F.poly([...a, ...b2, 388, 300, 214, 300], sc[1]); F.poly([...b2, 388, 300, 340, 300, b2[0] - 6, b2[1] + 4], sc[0]); F.line(a[0], a[1], 214, 300, sc[2]); F.line(a[0] + 1, a[1], 216, 300, sc[2]); for (let k = 0; k < 4; k++) F.path(qb([a[0] + 2 - k * 6, a[1] + 14 + k * 22], [a[0] + 18 - k * 4, a[1] + 8 + k * 22], [b2[0] + 2 + k * 8, b2[1] + 12 + k * 24], 6), sc[0]); } // 防护服的袖子：背光，朝水的一侧一道蓝边、几道褶
      poly([[0, -12], [30, -10], [33, -24], [2, -27]], gM); poly([[2, -24], [33, -21], [33, -24], [2, -27]], gL); // 手套的翻口
      poly([[-26, -4], [-22, 6], [22, 7], [28, -4], [24, -16], [-4, -18], [-22, -12]], gM); poly([[-24, -4], [-20, 3], [20, 4], [24, -3]], gL); // 手背
      for (const [a, w] of [[-17, 9.5], [-6.5, 10], [4, 9.5], [13.5, 8.5]]) { poly([[a - w / 2, 2], [a + w / 2, 2], [a + w / 2, 11], [a + w / 2 - 2, 14], [a - w / 2 + 2, 14], [a - w / 2, 11]], gM); poly([[a - w / 2 + 1, 12], [a + w / 2 - 1, 12], [a + w / 2 - 2.5, 14], [a - w / 2 + 2.5, 14]], rimC); F.line(...L(a - w / 2, 2), ...L(a - w / 2, 11), gD); F.line(...L(a - 1, 3), ...L(a + 1, 3), gL); } // 四根手指扣过栏杆，指尖朝水那边被照亮
      poly([[-24, -6], [-40, -2], [-44, 3], [-38, 5], [-22, 2]], gM); F.line(...L(-24, -6), ...L(-42, 0), gD); // 拇指从下面兜住
      for (let a = -20; a < 20; a += 9) F.line(...L(a, -14), ...L(a + 3, -6), gD); // 手背的褶
    });
  }
  // cg_trench：手电光里的一只大手动阀
  function cgTrenchBase() {
    return baked("cg_trench", L => {
      L.rect(0, 0, W, H, "cn1"); for (let y = 30; y < 222; y += 46) L.line(0, y, W, y, "cn0"); for (let x = 70; x < W; x += 140) L.line(x, 0, x, 222, "cn0");
      for (let i = 0; i < 12; i++) { const x = hsh(i, 60) * W, w = 20 + hsh(i, 61) * 50, len = 40 + hsh(i, 62) * 120; L.poly([x, 0, x + w, 0, x + w * 0.7, len, x + w * 0.25, len * 0.85], "cn0"); L.line(x + w * 0.4, len * 0.8, x + w * 0.42, len + 30, i % 3 ? "cn0" : "cn3"); } // 渗水的湿印
      L.rect(0, 222, W, H - 222, "sea1"); L.line(0, 222, W, 222, "cn0");
      for (let y = 100; y < 182; y++) { const f = (y - 100) / 82; L.line(0, y, W, y, f < 0.12 ? mix("g6", "white", 0.25) : f < 0.28 ? "g6" : f < 0.72 ? "g5" : f < 0.9 ? "g4" : "g3"); } // 横着的大管子
      for (let y = 100; y < 182; y++) for (let x = 0; x < W; x++) { const n2 = vnoise(x, y * 1.6, 14, 3) * 0.65 + vnoise(x, y, 5, 4) * 0.35; if (n2 > 0.62) L.px(x, y, n2 > 0.7 ? "rs2" : "rs1"); } // 锈斑：油漆一块块起皮
      for (let i = 0; i < 26; i++) { const x = hsh(i, 63) * W, y = 150 + hsh(i, 64) * 30; L.line(x, y, x + 1, y + 10 + hsh(i, 65) * 30, "rs1"); } // 锈水往下淌
      for (const x of [40, 440]) { L.rect(x - 8, 92, 16, 98, "g4"); L.line(x - 7, 92, x - 7, 189, "g6"); L.line(x + 7, 92, x + 7, 189, "g3"); for (const y of [98, 141, 184]) { L.ell(x, y, 3.5, 3, "cn2"); L.px(x - 1, y - 1, "cn4"); } L.line(x + 2, 190, x + 3, 222, "cn3"); } // 法兰、螺栓、底下渗出来的水痕
      L.rect(206, 160, 88, 62, "g4"); L.line(206, 160, 293, 160, "g6"); L.rect(200, 214, 100, 8, "g3"); // 阀体
      L.ell(250, 136, 50, 47, "g3"); L.ell(250, 136, 46, 43, "g4"); for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + 0.2; L.ell(250 + Math.cos(a) * 40, 136 + Math.sin(a) * 37, 4, 3.5, "cn2"); L.px(249 + Math.cos(a) * 40, 135 + Math.sin(a) * 37, "cn4"); } // 阀盖法兰
      // 阀轮：圈 + 5 根辐条 + 轮毂；锈，残着几块红漆
      const cx = 250, cy = 118, RX = 92, RY = 86, rx = 80, ry = 74, rust = (x, y) => (vnoise(x, y, 11, 5) * 0.7 + vnoise(x, y, 4, 6) * 0.3 > 0.55 ? "rd1" : "rs1"); // 剩下的红漆是一块块的
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k / 5) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), px = -sa, py = ca;
        const pts = [cx + ca * 16 + px * 6, cy + sa * 16 + py * 6, cx + ca * rx + px * 4.5, cy + sa * ry + py * 4.5, cx + ca * rx - px * 4.5, cy + sa * ry - py * 4.5, cx + ca * 16 - px * 6, cy + sa * 16 - py * 6];
        L.poly(pts, "rs1"); L.poly(pts, "rd1", 1, (x, y) => rust(x, y) === "rd1"); L.line(cx + ca * 16 + px * 5, cy + sa * 16 + py * 5, cx + ca * rx + px * 3.5, cy + sa * ry + py * 3.5, py < 0 || px < 0 ? "rs3" : "rs0");
      }
      for (let y = Math.floor(cy - RY); y <= cy + RY; y++) for (let x = Math.floor(cx - RX); x <= cx + RX; x++) {
        const e = ((x + 0.5 - cx) / RX) ** 2 + ((y + 0.5 - cy) / RY) ** 2, ei = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2; if (e > 1 || ei < 1) continue;
        const r = Math.sqrt(e), ri = Math.sqrt(ei), w = (r - rx / RX) / (1 - rx / RX), th = Math.atan2(y - cy, x - cx), lit = Math.cos(th + 2.2); // w：圈截面上的位置（0 内沿、1 外沿）
        let c = rust(x, y); if (w > 0.35 && w < 0.65 && lit > 0.2) c = c === "rd1" ? "rd2" : "rs3"; else if (w < 0.18 || w > 0.85) c = c === "rd1" ? "rd0" : "rs0";
        if (Math.floor(((th + Math.PI) / (Math.PI * 2)) * 36) % 2 === 0 && w > 0.82) c = "rs0"; // 外沿一圈防滑齿
        L.px(x, y, c);
      }
      L.ell(cx, cy, 20, 19, "rs0"); L.ell(cx, cy, 18, 17, "rs1"); L.ell(cx - 4, cy - 4, 8, 6, "rs2"); const hex = []; for (let k = 0; k < 6; k++) hex.push(cx + Math.cos((k / 6) * Math.PI * 2) * 9, cy + Math.sin((k / 6) * Math.PI * 2) * 9); L.poly(hex, "cn2"); L.line(hex[6], hex[7], hex[8], hex[9], "cn4"); L.ell(cx, cy, 4, 4, "cn3"); L.ell(cx, cy, 2, 2, "cn1"); // 轮毂、螺母、阀杆头
      { const a = -0.75, x0 = cx + Math.cos(a) * 86, y0 = cy + Math.sin(a) * 80; L.line(x0, y0, x0 + 3, y0 + 12, "cn3"); L.poly([x0 - 6, y0 + 12, x0 + 14, y0 + 14, x0 + 12, y0 + 42, x0 - 8, y0 + 40], "mapM"); L.poly([x0 - 6, y0 + 12, x0 + 14, y0 + 14, x0 + 14, y0 + 19, x0 - 6, y0 + 17], "rd1"); for (const d of [24, 29, 34]) L.line(x0 - 3, y0 + d, x0 + 9, y0 + d + 1, "cn1"); L.ell(x0 + 2, y0 + 36, 4, 3, "mapD"); } // 挂着的牌子
      for (const a of [1.35, 1.6, 1.85, 2.3]) { const x = cx + Math.cos(a) * 88, y = cy + Math.sin(a) * 84; L.rect(x, y + 1, 2, 3, "ck2"); L.px(x, y + 1, "ck4"); } // 挂在圈底下的水珠
    });
  }
  // cg_dawn：天快亮了，码头尽头几个披着毯子的背影
  //   backFigure 画一个坐着的背影：先毯子，再脖子、头、头发（马尾 / 低扎的辫子垂在毯子上）。光从前面的天上来：背是暗的，肩和头顶一道天光
  function backFigure(b, x, yb, o) {
    const [bd, bm, bl] = o.bl, w = o.w, top = yb - o.h, hr = o.hr, hx = x + (o.lean || 0), hy = top - hr + 4, [hd, hm, hl] = o.hairC;
    const sh = (sx) => qb([x + sx * 7, top], [x + sx * w * 0.95, top + 1], [x + sx * w, top + o.h * 0.4], 8);
    const L0 = sh(-1), R0 = sh(1), pts = [...L0, x - w - 3, yb, x + w + 3, yb]; for (let i = R0.length - 2; i >= 0; i -= 2) pts.push(R0[i], R0[i + 1]);
    b.poly(pts, bm); b.poly(pts, bd, 1, (px, py) => px > x + w * 0.3 + (py - top) * 0.15);
    for (const [f0, f1] of [[-0.55, -0.7], [-0.15, -0.25], [0.2, 0.3], [0.6, 0.75]]) b.path(qb([x + f0 * w, top + 8], [x + (f0 + f1) * w * 0.5 + 3, top + o.h * 0.6], [x + f1 * w, yb - 1], 8), bd); // 毯子的褶
    if (o.stripe) for (const d of [9, 13]) b.line(x - w - 2, yb - d, x + w + 2, yb - d, o.stripe);
    b.path(L0, bl); b.path(R0.slice(0, 8), mix(bl, bm, 0.4)); // 肩上一道天光
    b.ell(hx, top + 1, hr * 0.6, 5, mix(o.skin, "dn0", 0.3)); // 脖子
    if (o.ears) for (const s2 of [-1, 1]) { b.ell(hx + s2 * hr, hy + 2, 2.4, 4, o.skin); b.px(hx + s2 * (hr + 1), hy + 1, mix(o.skin, "dn4", 0.5)); }
    if (o.nape) b.ell(hx, hy + hr * 0.75, hr * 0.7, hr * 0.4, o.skin); // 寸头：后颈露出一截
    const nl = (px, py) => !o.nape || py < hy + hr * 0.72 - Math.abs(px - hx) * 0.25;
    b.ell(hx, hy, hr, hr + 0.5, hm, nl); b.ell(hx, hy, hr, hr + 0.5, hd, (px, py) => (px > hx + hr * 0.25 || py > hy + hr * 0.35) && nl(px, py));
    for (let a = -2.7; a < -0.4; a += 0.06) b.px(hx + Math.cos(a) * hr, hy + Math.sin(a) * (hr + 0.5), hl); // 头顶一道天光
    if (o.tail === "pony") { b.rect(hx - 2, hy + 3, 5, 2, "g1"); strand(b, hx, hy + 5, hx + 3, hy + 13, hx + 2, top + 12, 8, 2, hm, 10, 1.3); strand(b, hx + 1, hy + 6, hx + 3, hy + 13, hx + 2, top + 9, 1.3, 0.5, hd); b.line(hx - 2, hy + 6, hx - 1, top + 6, hl); }
    if (o.tail === "low") { strand(b, hx, top - 2, hx - 3, top + 14, hx - 1, top + 34, 9, 3, hm, 12, 1.2); strand(b, hx + 1, top + 1, hx - 1, top + 14, hx, top + 30, 1.4, 0.5, hd); b.rect(hx - 3, top - 1, 7, 2, "g1"); b.line(hx - 3, top + 2, hx - 4, top + 20, hl); }
  }
  function cgDawnBase() {
    return baked("cg_dawn", L => {
      const HZ = 128;
      L.vgrad(0, 0, W, HZ, ["dn0", "dn1", "dn1", "dn2", "dn3"]); bloom(L, 300, HZ, 300, 46, "dn4", 0.8, 5, 1.1);
      for (let i = 0; i < 7; i++) { const cy = 10 + i * 13 + hsh(i, 70) * 6, cx = hsh(i, 71) * W, len = 140 + hsh(i, 72) * 220, c = mix("dn1", "dn0", i % 2 ? 0.5 : 0); for (let k = 0; k < 6; k++) L.ell(cx - len / 2 + (k * len) / 5, cy, len / 7, 4 + hsh(i * 7 + k, 73) * 4, c, (x, y) => y < cy + 3); if (i % 3 === 1) L.line(cx - len / 4, cy + 3, cx + len / 4, cy + 3, mix("dn2", "dn3", 0.5)); }
      L.poly([0, HZ, 30, HZ - 3, 80, HZ - 2, 120, HZ], "dn1"); // 远处的岛
      L.poly([372, HZ, 392, HZ - 7, 420, HZ - 9, 480, HZ - 12, 480, HZ], "dn1"); L.rect(410, HZ - 18, 18, 10, "dn0"); L.rect(430, HZ - 14, 26, 6, "dn0"); L.rect(401, HZ - 46, 3, 38, "dn0"); // 对岸的研究所和烟囱
      L.vgrad(0, HZ, W, 72, ["dn3", "dn2", "dn1", "sea2"]); L.line(0, HZ, W, HZ, "dn4");
      for (let i = 0; i < 120; i++) { const y = HZ + 2 + hsh(i, 74) ** 1.6 * 66, x = hsh(i, 75) * W, len = 2 + (y - HZ) * 0.2 * hsh(i, 76); L.line(x, y, x + len, y, i % 3 ? "dn3" : "dn1"); }
      L.poly([0, 200, W, 200, W, H, 0, H], "woodD"); for (let k = -12; k <= 12; k++) L.line(240 + k * 24, 200, 240 + k * 60, H, "brownD"); L.rect(0, 197, W, 5, "dn1"); L.line(0, 197, W, 197, "dn3"); L.line(0, 202, W, 202, "brownD"); // 码头尽头：木板顺着往外铺，尽头一根横梁
      for (const x of [16, 464]) { L.rect(x - 6, 184, 12, 14, "dn0"); L.ell(x, 184, 9, 3.5, "dn1"); L.line(x - 8, 183, x + 2, 182, "dn3"); } // 角上的系缆桩
      L.rect(212, 176, 10, 24, "rd0"); L.rect(214, 172, 6, 4, "dn2"); L.rect(215, 169, 4, 3, "woodD"); L.line(213, 177, 213, 198, "rd1"); for (const [x, y] of [[216, 184], [219, 190]]) L.px(x, y, "am1"); // 暖水瓶
      for (const x of [228, 238]) { L.rect(x, 190, 7, 9, "dn3"); L.rect(x, 190, 7, 1, "rd1"); L.px(x + 7, 193, "dn2"); } // 两个搪瓷缸
      backFigure(L, 140, 202, { w: 42, h: 60, hr: 14, bl: ["g2", "g4", "g6"], hairC: ["ashD", "ash", "ashL"], skin: mix("skinT", "dn1", 0.45), ears: 1, nape: 1 }); // 郑岩：灰白寸头、军绿毯子，坐得离两个人远一点
      backFigure(L, 300, 202, { w: 33, h: 52, hr: 12.5, lean: 3, bl: ["dn0", "cn2", "cn3"], stripe: "cn4", hairC: ["hairB", "bkM", "bkL"], skin: mix("skin", "dn1", 0.45), tail: "pony" }); // 邝丽娟：短马尾、灰毯子两道白条，头往方以宁那边歪
      backFigure(L, 376, 202, { w: 34, h: 55, hr: 12.5, bl: [mix("woodD", "dn0", 0.3), mix("wood", "dn1", 0.4), mix("woodL", "dn2", 0.4)], hairC: ["fbD", "fbM", "fbL"], skin: mix("skin", "dn1", 0.45), tail: "low" }); // 方以宁：低扎的长发垂在毯子上
    });
  }
  // 封面：俯看水池，一只手把笔式剂量计举到蓝光前读数。下面四成压成暗底，留给标题
  function coverBase() {
    return baked("cover", L => {
      poolShaft(L, 206, 60, { x0: -220, x1: 640, y0: -170, y1: 260 }, { core: [5.1, 2.1], glow: 80, dark: 0.3 });
      for (let y = 136; y < H; y++) for (let x = 0; x < W; x++) { const f = Math.min(1, (y - 136) / 40); if (y >= 176 || bay(x, y) < f) L.px(x, y, y >= 176 ? "g0" : mix("g0", "ck0", 0.6)); }
      for (const [y, x0, x1] of [[206, 60, 170], [228, 260, 410], [248, 96, 190]]) L.line(x0, y, x1, y, "g1"); // 暗底里几道很淡的水纹
      const py = x => 70 + (x - 196) * 0.33, pen = (x0, x1, a0, b0, c) => L.poly([x0, py(x0) + a0, x1, py(x1) + a0, x1, py(x1) + b0, x0, py(x0) + b0], c); // 笔式剂量计：远端 (196, 70) 对着堆芯，近端在手里
      pen(196, 300, -5, 6, "cn1"); pen(196, 300, -5, -1, mix("silverM", "ck3", 0.45)); pen(196, 300, -5, -3, mix("silverL", "ck4", 0.6)); pen(196, 300, 4, 6, "cn0"); // 铝管：朝光的上沿亮
      pen(284, 300, -6, 7, "ink"); pen(256, 286, -9, -6, mix("silverM", "ck3", 0.3)); L.line(256, py(256) - 9, 286, py(286) - 9, "ck4"); L.rect(254, py(254) - 9, 3, 4, "silverD"); // 充电端的黑帽、笔夹
      pen(196, 201, -5, 6, "cn2"); pen(194, 197, -4, 5, "ck5"); bloom(L, 195, 70, 18, 18, "ck4", 0.7); bloom(L, 195, 70, 7, 7, "white", 0.6); // 远端：一圈金属、玻璃窗透着蓝光
      const sk = mix("skinD", "ck0", 0.6), skM = mix("skinD", "ck0", 0.5), skD = mix("skinS", "ink", 0.6), rim = mix("skin", "ck4", 0.55), slv = mix("nvM", "ink", 0.25);
      L.poly([330, 96, W, 90, W, 166, 334, 156], slv); L.poly([326, 98, 342, 95, 346, 154, 330, 157], mix("nvD", "ink", 0.3)); L.line(342, 95, W, 89, mix("nvL", "ck3", 0.5)); L.line(326, 98, 342, 95, mix("nvL", "ck3", 0.5)); // 工作服袖口
      L.poly([290, 86, 318, 90, 334, 100, 336, 142, 318, 152, 298, 144, 286, 112], sk); // 手背
      for (const [cx, cy, rx] of [[288, 118, 10], [292, 130, 10], [298, 141, 9]]) { L.ell(cx, cy, rx, 6.5, skM); L.path([cx - rx + 2, cy + 4, cx, cy + 6, cx + rx - 1, cy + 4], skD); } // 中指、无名指、小指蜷在手心
      strand(L, 306, 112, 282, 104, 258, py(258) + 7, 12, 8, skM, 12, 1.2); L.ell(258, py(258) + 7, 4, 4, skM); // 拇指从下面托着
      strand(L, 300, 90, 274, py(274) - 9, 248, py(248) - 7, 11, 7, sk, 12, 1.3); L.ell(248, py(248) - 7, 4, 3.5, sk); L.line(270, py(270) - 4, 276, py(276) - 4, skD); // 食指顺着笔压在上面
      L.path([245, py(245) - 9, 262, py(262) - 13, 290, 84, 318, 88], rim); L.path([255, py(255) + 9, 270, py(270) + 12, 280, 116], rim); L.path([278, 112, 280, 124, 284, 136, 290, 146], mix(rim, "ck0", 0.35)); // 朝蓝光的边一道亮
    });
  }
  SCENES.cg_pool = { name: "CG · 俯看水池", draw(b, t) {
    const U = baked("cg_pool:water", B => poolShaft(B, 296, 84, { x0: -130, x1: 640, y0: -120, y1: 236 }, { core: [6.3, 1.9], glow: 60 }));
    waterWobble(b, U, t); sparkles(b, t, 40, [20, 10, 440, 160], "ck4", "ck5"); b.blit(cgPoolFront(), 0, 0);
  } };
  SCENES.cg_trench = { name: "CG · 管沟里的阀门", draw(b, t) {
    paste(b, cgTrenchBase());
    const sx = 246 + Math.sin(t * 0.5) * 8, sy = 118 + Math.sin(t * 0.8) * 5;
    lightPass(b, [0.04, 0.05, 0.055], [{ x: sx, y: sy, r: 230, ry: 190, k: 1.75, c: "am4", p: 1.25, steps: 6 }, { x: sx - 20, y: sy - 20, r: 80, ry: 70, k: 0.4, c: "white", p: 1.3 }, { x: sx, y: 250, r: 120, ry: 30, k: 0.6, c: "am4", p: 1.2 }]);
    for (let i = 0; i < 22; i++) { const a = -2.6 + hsh(i, 80) * 1.6, r = 0.93 + hsh(i, 81) * 0.06, x = 250 + Math.cos(a) * 92 * r, y = 118 + Math.sin(a) * 86 * r; if (Math.sin(t * 1.5 + i) > -0.3) b.px(x, y, i % 3 ? "am4" : "white"); } // 湿的圈上，迎着手电那一面的反光点
    for (let i = 0; i < 3; i++) { const ph = (t * 0.7 + i * 0.33) % 1, x = 250 + Math.cos([1.4, 1.75, 2.3][i]) * 88, y0 = 118 + Math.sin([1.4, 1.75, 2.3][i]) * 84 + 4; if (ph < 0.6) b.rect(x, y0 + (226 - y0) * (ph / 0.6) ** 2, 1, 3, "am4"); else { const r = (ph - 0.6) * 40; for (let a = 0; a < 20; a++) b.px(x + Math.cos(a * 0.314) * r, 228 + Math.sin(a * 0.314) * r * 0.2, mix("sea3", "am3", 0.5)); } } // 水珠掉下去、地上积水一圈圈
  } };
  SCENES.cg_dawn = { name: "CG · 黎明的码头", draw(b, t) {
    paste(b, cgDawnBase());
    for (let i = 0; i < 26; i++) { const y = 144 + hsh(i, 90) * 48, x = (hsh(i, 91) * W + t * (3 + hsh(i, 92) * 4)) % W; if (Math.sin(t * 1.2 + i * 2.1) > 0.5) b.line(x, y, x + 3, y, "dn4"); } // 海面的微光
    for (let i = 0; i < 6; i++) { const ph = (t * 0.35 + i / 6) % 1, x = 221 + Math.sin(ph * 6 + i) * 2 + ph * 4, y = 186 - ph * 26; if (bay(Math.floor(x), Math.floor(y)) < 0.6 * (1 - ph)) b.px(x, y, "dn4"); } // 搪瓷缸里冒的热气
    if (Math.floor(t / 1.5) % 2 === 0) b.px(402, 95, "rd1"); // 对岸烟囱顶上的灯还在闪
  } };
  SCENES.cover = { name: "封面", draw(b, t) {
    paste(b, coverBase()); sparkles(b, t, 18, [60, 10, 360, 110], "ck3", "ck4");
  } };

  SCENES.black = { name: "黑屏", draw(b) { b.rect(0, 0, W, H, "ink"); } };
  SCENES.white = { name: "白光", draw(b) { b.rect(0, 0, W, H, "cream"); b.dith(0, 0, W, H, "white", 0.6); } };
  /* ==== 《余量》场景 END ==== */

  /* 一帧完整画面：场景 + 立绘（多人）+ 表情符号 + 时段调色 + 天气
   * 天气：场景自己画窗外的雨（o.weather）；OUTDOOR 里的场景整片下雨；CG 自己定光线，不做时段调色 */
  const OUTDOOR = new Set(["pier"]); // 室外场景：下雨时整片下
  const POS = { l: 120, c: 240, r: 360, ll: 70, rr: 410 };
  function frame(sceneId, t, opts = {}) {
    const b = new PB(W, H); (SCENES[sceneId] || SCENES.black).draw(b, t, opts);
    const cg = /^cg_/.test(sceneId), g = cg ? null : TOD[opts.tod]; if (g) b.grade(g[0], g[1]);
    if (opts.weather === "rain" && !cg) { b.grade("grey", 0.18); if (OUTDOOR.has(sceneId)) rainIn(b, 0, 0, W, H, t, 90); }
    for (const ch of opts.chars || []) {
      const s = castById[ch.id]; if (!s) continue;
      const cx = typeof ch.pos === "number" ? ch.pos : POS[ch.pos] || POS.c;
      const sp = compose(s, ch, t), hx = sp.headDx, hy = sp.headDy; // 呼吸、晃头、姿势、动作都在 compose 里按时间算
      if (g) sp.grade(g[0], g[1] * 0.6);
      const x = Math.round(cx - OW / 2), y = H - VIS + (ch.dy || 0); // 立绘比露出来的高：脚下那截在屏幕外
      b.blit(sp, x, y, ch.alpha == null ? 1 : ch.alpha, ch.dim || 0);
      if (ch.emote && EMOTES[ch.emote]) { const k = Math.min(1, (ch.emoteT == null ? 1 : ch.emoteT) * 4); EMOTES[ch.emote](b, cx + 30 + hx, y + 22 + hy - Math.round(4 * k)); }
    }
    if (opts.red) b.tint("red", 0.55);
    return b;
  }

  const API = { PAL, C, PB, bay, bust, compose, CAST, castById, EXPR, EXPR_NAMES, EYE, HAIR, OUTFITS, POSES, POSE_NAMES, ITEMS, ACTS, ACT_NAMES, EMOTES, EMOTE_NAMES, SCENES, TOD, POS, frame, W, H, SW: OW, SH, VIS, DW: SW, PADX,
    parts: { sky, windowRow, floorPlanks, glow, particles, bigBust, rainIn }, OUTDOOR };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.PixelArt = API;
})(typeof window !== "undefined" ? window : globalThis);
