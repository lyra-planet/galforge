/* 《余量》登记表：引擎和校验器共用。剧本里引用的场景、说话人、数值、音乐、音效、结局、章节都要在这里登记 */
(function (root) {
  const R = {};

  R.TITLE = { name: "余量", sub: "每个人今晚还能承受的剂量，记在我的本子上。", eyebrow: "一夜 · 四章 · 约 50 分钟", scene: "cover", tod: "day",
    cw: ["核事故", "辐射伤害", "受伤", "职场压力"],
    credits: "剧本由 AI 生成；画面全部用代码绘制，没有使用生图模型；配乐用 WebAudio 合成；没有配音。故事和地点都是虚构的。" };

  R.SCENES = {
    cover: "封面", control: "控制室", hall: "堆厅回廊", dosim: "剂量室", lock: "气闸走廊", trench: "管沟", pier: "码头",
    black: "黑屏", white: "白光",
    cg_pool: "水池的蓝光", cg_trench: "管沟里的阀门", cg_dawn: "黎明的码头",
  };
  R.TODS = ["day", "sunset", "night"]; // sunset 在本作当黎明前的天光用
  R.WEATHERS = ["clear", "rain"];
  R.PROPS = { low: "堆厅水位降下去（池壁露出湿痕）", alarm: "控制室警示灯转、报警牌闪红" };

  R.SPEAKERS = {
    "": { name: "", portrait: null, voice: null },
    me: { name: "许", portrait: null, voice: null },
    zheng: { name: "郑岩", portrait: "zheng", voice: null, color: "#9fb4c7" },
    kuang: { name: "邝丽娟", portrait: "kuang", voice: null, color: "#8fd3c1" },
    fang: { name: "方以宁", portrait: "fang", voice: null, color: "#d8c9a8" },
    boss: { name: "所长（电话）", portrait: null, voice: null, color: "#c98f7a" },
    pa: { name: "广播", portrait: null, voice: null, color: "#e0a83a" },
  };
  R.OUTFITS = { zheng: ["shift", "suit"], kuang: ["shift", "suit"], fang: ["coat", "suit"] };

  R.EXPRS = ["neutral", "smile", "grin", "shy", "pout", "angry", "sad", "cry", "surprise", "smug"];
  R.EMOTES = ["exclaim", "question", "sweat", "anger", "heart", "note", "dots", "sparkle", "gloom"];
  R.POSES = ["rest", "hip", "chest", "mouth", "think", "wave", "point", "cheer", "cross", "hold", "shrug", "clasp", "salute", "grip"];
  R.ACTS = ["nod", "shake", "jump", "hop", "shiver", "bow"];
  R.BGM = ["none", "theme", "hum", "pulse", "glass", "dawn"];
  R.SFX = ["click", "door", "chime", "bell", "heartbeat", "pop", "whoosh", "rain", "crowd", "glass", "alarm", "valve", "splash", "phone", "dosimeter"];
  R.AMB = ["none", "rain", "wind", "night", "waves", "clock", "geiger", "geigerhi", "pumps", "sea"];
  R.FX = ["shake", "shake2", "hshake", "white", "black", "red", "clear", "flash", "fade"];
  R.TRANS = ["cut", "dissolve", "black", "white", "wipe-l", "wipe-r", "wipe-u", "wipe-d", "iris", "blinds", "pixel", "eye-open", "eye-shut"];
  R.DEFAULT_TRANS = { kind: "dissolve", ms: 400 };

  // 数值 = 每个人今晚累计的剂量，1 = 50 mSv。2 = 100 mSv（抢救财产的上限）、10 = 500 mSv（救命的上限）、20 = 1 Sv（急性放射病的门槛）
  R.VARS = {
    me: { name: "许", init: 0 },
    zheng: { name: "郑岩", init: 0 },
    kuang: { name: "邝丽娟", init: 0 },
    fang: { name: "方以宁", init: 0 },
  };
  R.SHOW_AFFECTION = false;
  R.METERS = [
    { var: "me", label: "许", scale: 0.05, unit: " Sv", digits: 2, warn: 10 },
    { var: "zheng", label: "郑", scale: 0.05, unit: " Sv", digits: 2, warn: 10 },
    { var: "kuang", label: "邝", scale: 0.05, unit: " Sv", digits: 2, warn: 10 },
    { var: "fang", label: "方", scale: 0.05, unit: " Sv", digits: 2, warn: 10 },
  ];
  R.CLUES = {};

  R.ENDINGS = {
    E1: { name: "满水", desc: "水池保住了，没有人过五百，报告上一个数、一件事都没瞒。" },
    E2: { name: "余量", desc: "今晚最大的那个数，记在我自己名下。" },
    E3: { name: "记录", desc: "记录本交出去了。为这本子，有人过了线。" },
    E4: { name: "改写", desc: "我在剂量登记簿上改了一个数字。" },
    E5: { name: "空池", desc: "天亮前，堆芯上方的水薄到要撤人。我们都走着出来了，堆没有。" },
    E6: { name: "交班", desc: "天亮了，下一班的人来了。登记簿上的数是真的，可它没说完今晚的事。" },
  };

  R.CHAPTERS = {
    ch1: { title: "蓝光" },
    ch2: { title: "管沟" },
    ch3: { title: "记录本" },
    ch4: { title: "读数" },
  };
  R.FLOW = ["ch1", "ch2", "ch3", "ch4"];

  R.LINT = { maxLine: 44, maxNarr: 34, banned: "(的说|呐[，。！？]|酱[，。！？]|桑[，。！？]|如果是.{1,6}的话|给你看)", bannedWhy: "翻译腔", dayStart: "12:00", firstChoice: 40 };

  if (typeof module !== "undefined" && module.exports) module.exports = R; else root.REG = R;
})(typeof window !== "undefined" ? window : globalThis);
