/* 缺章：读 g_maybe，已写的章节里没人设（ch2 还没写，可能在那里设）→ 只提醒 W10 */
STORY.chapter({
  id: "ch1", title: "测试一",
  start: "c1_open",
  nodes: {
    c1_open: { scene: "place_a", bgm: "none", shot: "开头", lines: [["", "开头。"]],
      choices: [{ t: "有 g_maybe 才出现", next: "c1_end", need: ["g_maybe"] }, { t: "普通", next: "c1_end", add: { a: 1, b: 1 } }] },
    c1_end: { scene: "place_a", shot: "结束", lines: [["", "结束。"]], end: { type: "chapter" } },
  },
});
