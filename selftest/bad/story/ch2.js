/* 反例第二章 */
STORY.chapter({
  id: "ch2", title: "测试二",
  start: "c2_open",
  nodes: {
    // 埋错 E24：读 f_pickA，它只在 ch1 设（f_ 换章清空）；设 g_fromCh2 给 ch1 读（E26 的另一半）
    // 埋错 W11：第 3 天之后到了第 2 天（c2_c）；E29：day 不是正整数（c2_e）
    c2_open: { scene: "place_a", bgm: "t1", set: "g_fromCh2", day: 3, time: "09:00", shot: "开头",
      lines: [["a", "你上次选了我。", "smile", { need: ["f_pickA"] }], ["", "一。"], ["", "二。"]], next: "c2_b" },
    // 埋错 W7：一章 13 句换 3 次曲
    c2_b: { scene: "place_a", bgm: "t4", shot: "换曲", lines: [["", "三。"], ["", "四。"], ["", "五。"]], next: "c2_c" },
    c2_c: { scene: "place_a", bgm: "t5", day: 2, time: "10:00", shot: "换曲", lines: [["", "六。"], ["", "七。"], ["", "八。"]], next: "c2_d" },
    // 埋错 E27：读 g_ghost，全剧（章节都写完了）没有任何地方设
    c2_d: { scene: "place_a", bgm: "t3", shot: "换曲", lines: [["", "九。"], ["", "十。"]],
      branch: [{ need: ["g_ghost"], next: "c2_e" }, { next: "c2_e" }] },
    c2_e: { scene: "place_a", bgm: "none", day: 1.5, shot: "静音", lines: [["", "十一。"], ["", "十二。"]], end: { type: "ending", id: "E1" } },
  },
});
