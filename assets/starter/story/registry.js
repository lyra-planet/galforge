/* 剧本登记表：引擎和校验器共用。剧本里引用的场景、说话人、线索、数值、音乐、音效、结局、章节都必须在这里登记。
 * 下面全是占位示例，开工后整份换成自己游戏的内容。
 */
(function (root) {
  const R = {};

  // 标题页；name 也用作存档的命名空间（同一个域名下多个游戏不会串档），换游戏一定要改
  // eyebrow：标题上方一行小字，写「类型 · 时长」；scene / tod：标题页背景
  // cw：内容提示（标题页一个按钮展开，默认收起），空数组 = 不显示；开工时问用户有哪些要提示的内容再填
  // credits：制作说明（标题页「制作说明」按钮）
  R.TITLE = { name: "游戏名", sub: "一句话副标题", eyebrow: "类型 · 约 N 分钟", scene: "place_a", tod: "day",
    cw: [],
    credits: "剧本由 <模型名> 生成；画面全部用代码绘制，没有使用生图模型；配乐用 WebAudio 合成；配音为 TTS 合成。" };

  // 场景：pixel_art.js 里 SCENES 的 id；cg_ 开头的是 CG（全屏事件图，看过就进回想）
  R.SCENES = { place_a: "场景 A（占位）", place_b: "场景 B（占位）", black: "黑屏", white: "白光" };
  R.TODS = ["day", "sunset", "night"];
  // R.DAY_LABEL = "第 {d} 天";  // 节点写 day 时 HUD 要不要显示第几天：不写就只显示钟点（默认不数天，见 defaults-check「钩子和设定」）
  R.WEATHERS = ["clear", "rain"]; // 天气：节点写 weather，沿用到下次改；有窗的场景窗外下雨，室外场景整片下雨 // 时段：节点写 tod，画面自动调色

  // 说话人：portrait = pixel_art.js 的 CAST id；voice = TTS 音色（null 不配音）；color = 名牌颜色
  R.SPEAKERS = {
    "": { name: "", portrait: null, voice: null }, // 旁白 / 主角内心独白
    me: { name: "我", portrait: null, voice: null }, // 主角说出口的话
    a: { name: "占位 1", portrait: "a", voice: null, color: "#d8d8d8" },
    b: { name: "占位 2", portrait: "b", voice: null, color: "#b0b0b0" },
    c: { name: "占位 3", portrait: "c", voice: null, color: "#8c8c8c" },
  };
  R.OUTFITS = { a: ["main", "alt"], b: ["main", "alt"], c: ["main", "alt"] }; // 和 pixel_art.js 的 outfits 对上，第一个是默认

  R.EXPRS = ["neutral", "smile", "grin", "shy", "pout", "angry", "sad", "cry", "surprise", "smug"];
  R.EMOTES = ["exclaim", "question", "sweat", "anger", "heart", "note", "dots", "sparkle", "gloom"];
  R.POSES = ["rest", "hip", "chest", "mouth", "think", "wave", "point", "cheer", "cross", "hold", "shrug", "clasp", "salute", "grip"]; // 和 pixel_art.js 的 POSES 对上
  R.ACTS = ["nod", "shake", "jump", "hop", "shiver", "bow"];
  R.BGM = ["none", "t1", "t2", "t3", "t4", "t5", "t6"]; // music.js 的 TRACKS（示范曲，本作按情绪地图重写）
  R.SFX = ["click", "door", "chime", "bell", "heartbeat", "pop", "whoosh", "rain", "crowd", "glass"]; // music.js 的 SFX
  R.AMB = ["none", "rain", "cicada", "wind", "crowd", "night", "waves", "clock"]; // music.js 的 AMB：环境音，节点或台词写 amb，沿用到下次改；weather: "rain" 且没写 amb 时自动 rain；每章开头清零
  R.FX = ["shake", "shake2", "hshake", "white", "black", "red", "clear", "flash", "fade"]; // shake2 加倍震、hshake 只横震、white / black 闪白闪黑
  // 转场：节点写 trans（或 { kind, ms }）；不写时场景变了用 DEFAULT_TRANS，场景没变不转场；快进时一律 cut
  R.TRANS = ["cut", "dissolve", "black", "white", "wipe-l", "wipe-r", "wipe-u", "wipe-d", "iris", "blinds", "pixel", "eye-open", "eye-shut"];
  R.DEFAULT_TRANS = { kind: "dissolve", ms: 400 };
  R.PROPS = {}; // 场景里能开关的东西：{ 名字: "说明" }，节点或台词里写 props: { 名字: 1 / 0 }，场景 draw 里读 o.props

  // 数值：跨章保留，新游戏归零。有几个数值、叫什么、跟谁绑定，从构思来；不一定是好感
  //   选项、节点里写 add: { v1: 1 }；条件写 "v1>=3"，多个数值时还能写 "v1>v2"
  R.VARS = { v1: { name: "数值 1", init: 0 } };
  R.SHOW_AFFECTION = false; // true：数值上升时弹一个「♥ 数值名」提示

  // 线索（可选，要收集线索的游戏才用）：跨章保留；ch = 首次能拿到的章节号；desc 原样显示在线索本里。没有线索时 HUD 不显示线索按钮
  R.CLUES = {};

  R.ENDINGS = {
    E1: { name: "示例结局一", desc: "一句话。" },
    E2: { name: "示例结局二", desc: "一句话。" },
  };

  // 章节：label 可选，覆盖标题卡上的「第 N 章」
  R.CHAPTERS = { ch1: { title: "示例章" } };

  // 章节流程：字符串 = 按顺序玩；{ pick: [...] } = 自选顺序。分线一般不写进 FLOW，由共通段章末 end: { type: "chapter", id } 跳过去
  R.FLOW = ["ch1"];

  // 给 tools/validate.js 的题材规则：台词 / 旁白字数（写作目标 40 / 30，这里是提醒线），禁用词正则，跨午夜的时间，第一章开头到第一个选择点最多几句
  //   banned 默认是中文翻译腔：会误报，只当提醒；人设需要的词从正则里删掉
  R.LINT = { maxLine: 44, maxNarr: 34, banned: "(的说|呐[，。！？]|酱[，。！？]|桑[，。！？]|如果是.{1,6}的话|给你看)", bannedWhy: "翻译腔", dayStart: "05:00", firstChoice: 40 };

  if (typeof module !== "undefined" && module.exports) module.exports = R; else root.REG = R;
})(typeof window !== "undefined" ? window : globalThis);
