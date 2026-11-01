#!/usr/bin/env node
/* 把 pixel_art.js 画的东西渲染成 PNG，给没有浏览器的 agent 自己看图检查。
 * node tools/render_png.js <输出目录> [场景id ...]
 * 输出：
 *   cast.png    全部角色 × 全部表情
 *   anim.png    每个角色：眨眼 3 帧、说话 2 帧、每套服装、每个表情符号
 *   scenes.png  全部场景 × 白天 / 傍晚 / 夜里
 *   poses.png   每个角色：全部姿势一行、一次性动作（点头、摇头……）最用力的那一帧一行
 *   stage.png   两个人同屏（说话的人亮、另一个压暗）的合成画面
 *   scene_<id>.png  指定场景的大图
 * 只用 node 自带的 zlib，不装任何包。游戏目录 = $GAME_DIR，没设就是本脚本的上一级
 */
const zlib = require("zlib"), fs = require("fs"), path = require("path");
const A = require(path.join(process.env.GAME_DIR || path.join(__dirname, ".."), "pixel_art.js"));
const [, , OUT = ".", ...pick] = process.argv;
fs.mkdirSync(OUT, { recursive: true });

function crc(buf) {
  let x = 0xffffffff;
  for (const b of buf) { let c = (x ^ b) & 255; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; x = c ^ (x >>> 8); }
  return (x ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
// pb: PixelArt.PB（w, h, d=RGBA）；透明像素填成深灰，方便看出轮廓
function png(pb, scale, file) {
  const w = pb.w * scale, h = pb.h * scale, raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const si = (((y / scale) | 0) * pb.w + ((x / scale) | 0)) * 4, di = y * (w * 4 + 1) + 1 + x * 4, a = pb.d[si + 3];
    raw[di] = a ? pb.d[si] : 40; raw[di + 1] = a ? pb.d[si + 1] : 44; raw[di + 2] = a ? pb.d[si + 2] : 52; raw[di + 3] = 255;
  }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
  console.log(file);
}
const SW = A.SW || 64, SH = A.SH || 80, G = 4;

// 全部角色 × 全部表情
const ex = Object.keys(A.EXPR);
const cast = new A.PB((SW + G) * ex.length, A.CAST.length * (SH + G));
A.CAST.forEach((c, r) => ex.forEach((e, i) => cast.blit(A.bust(c, e), i * (SW + G), r * (SH + G))));
png(cast, 2, path.join(OUT, "cast.png"));

// 动画帧和服装、表情符号
if (A.EMOTES) {
  const emotes = Object.keys(A.EMOTES);
  const cols = Math.max(5 + Object.keys(A.CAST[0].outfits || {}).length, emotes.length);
  const anim = new A.PB((SW + G) * cols, A.CAST.length * (SH + G) * 2);
  A.CAST.forEach((c, r) => {
    const y = r * (SH + G) * 2, frames = [{ blink: 0 }, { blink: 1 }, { blink: 2 }, { talk: 1 }, { ex: "smile", talk: 1 }];
    frames.forEach((f, i) => anim.blit(A.bust(c, f.ex || "neutral", f), i * (SW + G), y));
    Object.keys(c.outfits || {}).forEach((o, i) => anim.blit(A.bust(c, "smile", { outfit: o }), (5 + i) * (SW + G), y));
    emotes.forEach((em, i) => { const f = new A.PB(SW + G, SH + G); f.blit(A.bust(c, "neutral"), 0, 0); A.EMOTES[em](f, 86, 22); anim.blit(f, i * (SW + G), y + SH + G); });
  });
  png(anim, 2, path.join(OUT, "anim.png"));
}

// 全部角色 × 全部姿势；再加一条「动作」帧：每个一次性动作取最用力的那一刻
if (A.POSES) {
  const P = Object.keys(A.POSES), acts = Object.keys(A.ACTS || {}).filter(k => k !== "bob");
  const poses = new A.PB((SW + G) * Math.max(P.length, acts.length), A.CAST.length * (SH + G) * 2);
  A.CAST.forEach((c, r) => {
    P.forEach((p, i) => poses.blit(A.bust(c, "smile", { pose: p }), i * (SW + G), r * (SH + G) * 2));
    acts.forEach((a, i) => poses.blit(A.compose(c, { ex: "neutral", act: a, actT: A.ACTS[a] * 0.25 }, 0), i * (SW + G), r * (SH + G) * 2 + SH + G));
  });
  png(poses, 2, path.join(OUT, "poses.png"));
}

// 全部场景（有时段调色的话，白天 / 傍晚 / 夜里各一张）
const ids = Object.keys(A.SCENES), tods = A.TOD ? ["day", "sunset", "night"] : ["day"];
const scenes = new A.PB((A.W + G) * tods.length, ids.length * (A.H + G));
ids.forEach((id, r) => tods.forEach((tod, i) => scenes.blit(A.frame(id, 1.3, { tod }), i * (A.W + G), r * (A.H + G))));
png(scenes, 1, path.join(OUT, "scenes.png"));

// 两人同屏：左边的人在说话，右边的压暗
if (A.CAST.length >= 2 && A.POS) {
  const [a, b] = A.CAST;
  png(A.frame(ids[0], 2, { chars: [{ id: a.id, pos: "l", ex: "grin", talk: 1, emote: "note" }, { id: b.id, pos: "r", ex: "pout", dim: 0.35 }] }), 2, path.join(OUT, "stage.png"));
}
for (const id of pick) png(A.frame(id, 2, {}), 2, path.join(OUT, `scene_${id}.png`));
