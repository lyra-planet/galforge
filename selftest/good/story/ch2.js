/* 正例第二章：读第一章超时设的 g_silent；好感判定（--odds 用） */
STORY.chapter({
  id: "ch2", title: "测试二",
  start: "c2_open",
  nodes: {
    c2_open: { scene: "place_a", tod: "day", trans: "black", bgm: "t4", amb: "rain", weather: "rain", day: 1, time: "20:00", shot: "雨天的场景 A",
      lines: [["", "第二天，下雨。"], ["a", "昨天的事……", "neutral"]],
      branch: [{ need: ["g_silent"], next: "c2_quiet" }, { next: "c2_talk" }] },
    c2_quiet: { scene: "place_a", bgm: "none", shot: "她不看我", lines: [["a", "你昨天什么都没说。", "sad"], ["", "她走了。"]], end: { type: "ending", id: "E3" } },
    c2_talk: { scene: "place_a", day: 2, time: "08:00", shot: "她看着我", lines: [["a", "今天说点什么吧。", "smile"], ...Array.from({ length: 24 }, (_, i) => ["", `填充旁白 ${i + 1}。`])],
      choices: [{ t: "认真回答", next: "c2_judge", add: { a: 2 } }, { t: "随便应付", next: "c2_judge" }, { t: "岔开话题", next: "c2_judge", add: { a: -1 } }] },
    c2_judge: { scene: "place_a", shot: "好感判定，不显示", branch: [{ need: ["a>=4"], next: "c2_good" }, { next: "c2_normal" }] },
    c2_good: { scene: "white", trans: "eye-open", bgm: "t3", shot: "白光", lines: [["", "好结局。"]], end: { type: "ending", id: "E1" } },
    c2_normal: { scene: "place_a", bgm: "none", shot: "结束", lines: [["", "普通结局。"]], end: { type: "ending", id: "E2" } },
  },
});
