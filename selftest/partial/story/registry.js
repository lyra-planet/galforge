/* 工具测试·缺章：ch2 登记了还没写；读一个已写章节里没人设的 g_ 只提醒、不报错 */
(function (root) {
  const R = {};
  R.TITLE = { name: "工具测试缺章", sub: "", eyebrow: "", scene: "place_a", tod: "day", cw: ["恋爱"], credits: "测试用" };
  R.SCENES = { place_a: "场景 A（占位）", place_b: "场景 B（占位）", black: "黑屏", white: "白光" };
  R.TODS = ["day", "sunset", "night"];
  R.WEATHERS = ["clear", "rain"];
  R.SPEAKERS = {
    "": { name: "", portrait: null, voice: null },
    me: { name: "我", portrait: null, voice: null },
    a: { name: "A", portrait: "a", voice: "voiceA", color: "#f08fb4" },
    b: { name: "B", portrait: "b", voice: "voiceB", color: "#a9c6ee" },
  };
  R.OUTFITS = { a: ["main", "alt"], b: ["main", "alt"] };
  R.EXPRS = ["neutral", "smile", "grin", "shy", "pout", "angry", "sad", "cry", "surprise", "smug"];
  R.EMOTES = ["exclaim", "question", "sweat", "anger", "heart", "note", "dots", "sparkle", "gloom"];
  R.POSES = ["rest", "hip", "chest", "mouth", "think", "wave", "point", "cheer", "cross", "hold", "shrug", "clasp", "salute", "grip"];
  R.ACTS = ["nod", "shake", "jump", "hop", "shiver", "bow"];
  R.BGM = ["none", "t1", "t2", "t3", "t4", "t5", "t6"];
  R.SFX = ["click", "door", "chime", "bell", "heartbeat", "pop", "whoosh", "rain", "crowd", "glass"];
  R.FX = ["shake", "shake2", "hshake", "white", "black", "red", "flash", "fade"];
  R.TRANS = ["cut", "dissolve", "black", "white", "wipe-l", "wipe-r", "wipe-u", "wipe-d", "iris", "blinds", "pixel", "eye-open", "eye-shut"];
  R.DEFAULT_TRANS = { kind: "dissolve", ms: 400 };
  R.AMB = ["none", "rain", "cicada", "wind", "crowd", "night", "waves", "clock"];
  R.PROPS = {};
  R.VARS = { a: { name: "A", init: 0 }, b: { name: "B", init: 0 } };
  R.SHOW_AFFECTION = false;
  R.CLUES = {};
  R.ENDINGS = { E1: { name: "好结局", desc: "" }, E2: { name: "普通结局", desc: "" }, E3: { name: "沉默结局", desc: "只有超时能到" } };
  R.CHAPTERS = { ch1: { title: "测试一" }, ch2: { title: "测试二" } };
  R.FLOW = ["ch1", "ch2"];
  R.LINT = { maxLine: 44, maxNarr: 34, banned: null, bannedWhy: "", dayStart: "05:00", firstChoice: 40 };
  if (typeof module !== "undefined" && module.exports) module.exports = R; else root.REG = R;
})(typeof window !== "undefined" ? window : globalThis);
