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
   *   - 胸是两个球（atam、Palmie、ichi-up）：上半迎光提一档亮、中间底色、下半一影（往右下偏）、贴着下沿一道二影，两胸之间一道一影连起来；
   *     位置：上沿和腋下一样高、下沿在心窝上、挂在锁骨中段下、外沿到胳膊下
   *   - 男生：胸肌左上一块亮
   *   s.bust 调胸的大小：没写时 age >= 18 的女性角色是 1，未满 18 或没写 age 是 0（不强调身材）；显式写了以显式为准
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
    if (s.hair === "ponytail") { strand(b, 78, 22, 112, 64, 92, 138, 26, 3, R.M, 16, 1.6); strand(b, 96, 70, 110, 104, 104, 130, 10, 1, R.M); strand(b, 86, 36, 106, 76, 95, 124, 2.4, 0.6, R.D); }
    if (s.hair === "sidetail") strand(b, 90, 38, 106, 80, 94, 128, 16, 3, R.M);
  }
  // 前发的对称部分（左半边）：头顶、侧发、齐刘海
  function hairFront(b, s, R) {
    const male = !!s.male, style = s.hair;
    b.ell(HX + 0.5, 44, male ? 31 : 34, male ? 29 : 31, R.M, (x, y) => y < 46); // 头顶：比头骨大一圈，显得蓬松
    const sideLen = style === "short" ? (male ? 66 : 74) : style === "bob" ? 94 : 104;
    strand(b, HX - 27, 42, HX - 32, 70, HX - 25, sideLen, 11, 2, R.M, 14, 1.5); // 侧发：盖住脸的边
    if (s.bangs === "blunt") { b.rect(HX - 30, 38, 31, 16, R.M); for (const dx of [-20, -8]) strand(b, HX + dx, 40, HX + dx, 47, HX + dx + 1, 53, 2.2, 0.8, R.D); }
  }
  // 前发里不对称的：分缝的刘海、亮面、呆毛
  function hairFrontExtra(b, s, R) {
    const male = !!s.male, rx = male ? 31 : 34, ry = male ? 29 : 31;
    if (s.bangs !== "blunt") {
      // 每束 [尖的 x 偏移, 尖的 y, 根部宽, 往外扫]；分缝偏左，长的那束垂在两眼之间
      const tips = male ? [[-29, 52, 11, -3], [-19, 58, 13, -3], [-8, 52, 11, -1], [3, 59, 13, 2], [14, 53, 12, 3], [24, 58, 12, 3], [30, 52, 9, 2]]
        : [[-29, 60, 11, -3], [-20, 56, 13, -3], [-11, 61, 13, -2], [-3, 54, 9, 0], [5, 62, 14, 2], [15, 56, 12, 3], [24, 61, 12, 3], [30, 56, 9, 2]];
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
    if (style === "ponytail") { bow(b, 82, 26, c); mirrorBow(b, 82, 26, c); }
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
    const S = s.skin || "skin", SD = skinShade(S), male = !!s.male, fw = male ? 26 : 24, chin = CHIN + (male ? 1 : 0), jaw = male ? 6 : 8;
    const face = new PB(SW, SH);
    face.poly([HX + 1, 20, ...qb([HX, 20], [HX - fw, 20], [HX - fw, 46]), ...qb([HX - fw, 46], [HX - fw - 1, 72], [HX - fw + jaw, 85]).slice(2), ...qb([HX - fw + jaw, 85], [HX - fw + 14, 91], [HX, chin]).slice(2), HX + 1, chin], S);
    face.ell(HX - fw + 1, 65, 2.6, 5, S); face.line(HX - fw, 63, HX - fw, 67, SD); // 耳朵（带耳窝）
    if (s.ears === "elf") { face.poly([HX - fw + 2, 58, HX - fw - 16, 47, HX - fw - 1, 69], S); face.line(HX - fw - 12, 50, HX - fw, 62, SD); } // 精灵的尖耳朵：尖要伸出侧发
    mirrorHalf(face); face.edge(mix(SD, "brownD", 0.55)); face.fw = fw;
    return (layersOf.cache[k] = face);
  }
  const skinShade = S => ({ skinL: "skin", skin: "skinD", skinD: "wood" }[S] || "skinD");
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
      for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) if (face.a(x, y) && !front.a(x, y) && (front.a(x, y - 1) || front.a(x, y - 2) || front.a(x, y - 3))) b.px(x, y, SD);
      b.blit(front, 0, 0);
      brow(b, EXL, EY - 10, e.brow, R.D, male); brow(mb, EXL, EY - 10, e.brow, R.D, male); // 眉毛画在刘海上面
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
   *   age: 年龄（必填）。胸的体积明暗只给 18 岁以上的女性角色；可攻略角色默认写 18 岁以上；bust 显式写了以显式为准
   *   male: 1 男生体型和眼型；acc: glasses | earrings；ribbon / pin / headband：发饰颜色
   *   ears: "elf" 尖耳朵；hat: "witch" 巫师帽（hatC [深, 中, 浅]、hatBand 帽带色、hatGem 宝石色）；item: book letter mug orb（hold / grip 姿势拿着）
   *   expr: 覆盖某个表情的局部，例 { neutral: { mouth: "small" } }（平时就抿着嘴的人）
   */
  // 占位角色：只演示参数怎么写，故意不带长相和性格（同一发型、灰衣，只靠衣服的明度分人；不戴眼镜、不加发饰、不写 expr）
  //   人数、性别、长相全部按本作人物表重写，连 id 一起换
  const GREY = { l: ["grey", "silver", "white"], m: ["shadow", "dusk", "grey"], d: ["night", "deep", "shadow"] }; // 浅、中、深灰
  const CAST = [
    { id: "a", name: "占位 1", age: 25, hair: "short", hairC: "black", eyeC: "grey",
      outfits: { main: { type: "sweater", main: GREY.l }, alt: { type: "hoodie", main: GREY.l } }, note: "占位：浅灰" },
    { id: "b", name: "占位 2", age: 25, hair: "short", hairC: "black", eyeC: "grey",
      outfits: { main: { type: "sweater", main: GREY.m }, alt: { type: "hoodie", main: GREY.m } }, note: "占位：中灰" },
    { id: "c", name: "占位 3", age: 25, male: 1, hair: "short", hairC: "black", eyeC: "grey",
      outfits: { main: { type: "sweater", main: GREY.d }, alt: { type: "hoodie", main: GREY.d } }, note: "占位：深灰、男性体型" },
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
  const TOD = { day: null, sunset: ["sunset", 0.32], night: ["blueD", 0.5] }; // 时段调色：傍晚偏暖、夜里偏蓝
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

  /* 占位场景：灰盒，只用来演示时段调色、窗外下雨、室外整片下雨。开工后整份换成本作的场景（连同下面三个小工具）
   *   place_a 室内：墙、一扇窗（下雨时窗里下）、透视地面；place_b 室外：天空、地平线、透视地面（在 OUTDOOR 里） */
  const GB = { l: [204, 204, 200], m: [170, 170, 166], d: [134, 134, 130], k: [92, 92, 90] }; // 中性灰：浅、中、深、线
  const GLYPH = { A: ["010", "101", "111", "101", "101"], B: ["110", "101", "110", "101", "110"] };
  function placeTag(b, ch) { const x0 = W - 34, y0 = 10; b.rect(x0, y0, 24, 28, GB.k); GLYPH[ch].forEach((r, j) => [...r].forEach((v, i) => { if (v === "1") b.rect(x0 + 6 + i * 4, y0 + 4 + j * 4, 4, 4, GB.l); })); } // 右上角的字母牌
  function gridFloor(b, y0, vy) { // 透视网格地面：竖线收向 (W/2, vy)，横线近疏远密
    b.vgrad(0, y0, W, H - y0, [GB.m, GB.d]);
    for (let k = -8; k <= 8; k++) { const xb = W / 2 + k * 90; b.line(W / 2 + (xb - W / 2) * (y0 - vy) / (H - vy), y0, xb, H, GB.k); }
    for (let z = 1.3; ; z *= 1.3) { const y = vy + (H - vy) / z; if (y <= y0 + 2) break; b.line(0, y, W, y, GB.k); }
  }

  const SCENES = {
    place_a: { name: "场景 A（占位）", draw(b, t, o) {
      b.vgrad(0, 0, W, 200, [GB.l, GB.m]);
      for (let x = 96; x < W; x += 96) b.line(x, 0, x, 199, GB.d); // 墙板接缝
      windowRow(b, 48, 44, 2, 96, 88, 12, o.tod, o.weather, t);
      b.rect(42, 135, 216, 4, GB.d); // 窗台
      b.rect(0, 196, W, 4, GB.k); // 墙地分界
      gridFloor(b, 200, 140); placeTag(b, "A");
    } },
    place_b: { name: "场景 B（占位）", draw(b, t, o) {
      sky(b, 0, 150, o.tod);
      gridFloor(b, 150, 144); b.line(0, 150, W, 150, GB.k); placeTag(b, "B");
    } },
    black: { name: "黑屏", draw(b) { b.rect(0, 0, W, H, "ink"); } },
    white: { name: "白光", draw(b) { b.rect(0, 0, W, H, "cream"); b.dith(0, 0, W, H, "white", 0.6); } },
  };

  /* 一帧完整画面：场景 + 立绘（多人）+ 表情符号 + 时段调色 + 天气
   * 天气：场景自己画窗外的雨（o.weather）；OUTDOOR 里的场景整片下雨；CG 自己定光线，不做时段调色 */
  const OUTDOOR = new Set(["place_b"]); // 室外场景的 id 加进来
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
