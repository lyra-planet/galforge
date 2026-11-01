/* 反例第一章：每处「埋错 Xn」对应 run.sh 里的一条期望（E = 错误，W = 提醒） */
STORY.chapter({
  id: "ch1", title: "测试一",
  start: "c1_open",
  nodes: {
    // 埋错 W5：开头 46 句（含选择节点那句）才到第一个选择点（默认 firstChoice 40）；E1 未知转场；E3 未知环境音；E6 bgmVol 超范围
    c1_open: { scene: "place_a", tod: "day", bgm: "t1", trans: "spin", amb: "thunder", bgmVol: 1.5, shot: "场景 A",
      lines: Array.from({ length: 45 }, (_, i) => ["", `开场第 ${i + 1} 句。`]), next: "c1_q" },
    // 埋错 W1 限时没写 timeout；W2 timer 3 秒；E23 读拼错的 f_pikcA；W3 设了本章没人读的 f_unused；W4 设了全剧没人读的 g_never；E26 读只在之后 ch2 设的 g_fromCh2
    c1_q: { scene: "place_a", shot: "选择",
      lines: [["a", "选吧。", "neutral"]],
      timer: 3,
      choices: [{ t: "一", next: "c1_q2", set: ["f_pickA", "f_unused", "g_never"], add: { a: 3 } },
                { t: "二", next: "c1_q2", need: ["f_pikcA"] },
                { t: "三", next: "c1_q2", need: ["g_fromCh2"] }] },
    // 埋错 E8 timeout 多了 clue；E9 timeout.next 不存在；E2 trans 对象多了 speed；E4 bgm 对象未知曲名
    // 埋错 W12：c1_q 的三个选项都到这里，台词却按好感值分
    c1_q2: { scene: "place_a", trans: { kind: "iris", speed: 3 }, bgm: { id: "jazz", fade: 2 }, shot: "第二个限时",
      lines: [["a", "再选。", "neutral", { need: ["a>=3"] }]],
      timer: 8, timeout: { next: "c1_nowhere", clue: "x", add: { a: 1 } },
      choices: [{ t: "好", next: "c1_mid" }, { t: "不好", next: "c1_mid" }] },
    // 埋错 E7 没有 timer 却写了 timeout；E5 bgm.fade 不是数字
    c1_mid: { scene: "place_a", bgm: { id: "t5", fade: "slow" }, timeout: { next: "c1_lines" }, shot: "中间",
      lines: [["", "中间。"]], next: "c1_mid2" },
    // 埋错 E28 timer 写在没有 choices 的节点
    c1_mid2: { scene: "place_a", timer: 6, shot: "中间二", lines: [["", "中间二。"]], next: "c1_lines" },
    // 台词第 4 项和文字标记：E10 未知键；E11 fx 未知；E12 enter 取值错；E13 exit 没和 stage 一起；E14 amb 未知；E15 bgm 未知；E16 need 未登记数值
    //   E17 未知标记；E18 没关；E19 没开就关；E20 交叉；E21 {w=abc}；E22 落单花括号；E25 读 f_late，但设它的 c1_late 在这之后
    c1_lines: { scene: "place_a", stage: { l: "a" }, shot: "台词测试",
      lines: [["a", "一。", "neutral", { shake: 1 }],
              ["a", "二。", "neutral", { fx: "spin" }],
              ["b", "三。", "neutral", { stage: { l: "a", r: "b" }, enter: "top" }],
              ["a", "四。", "neutral", { exit: "left" }],
              ["a", "五。", "neutral", { amb: "thunder" }],
              ["a", "六。", "neutral", { bgm: "jazz" }],
              ["a", "七。", "neutral", { need: ["zz>=3"] }],
              ["a", "{blink}八。", "neutral"],
              ["a", "{slow}九。", "neutral"],
              ["a", "十。{/big}", "neutral"],
              ["a", "{big}{red}十一{/big}{/red}", "neutral"],
              ["a", "十二{w=abc}。", "neutral"],
              ["a", "十三}。", "neutral"],
              ["a", "早就设好了吧？", "neutral", { need: ["f_late"] }],
              ["", "{big}这一句去掉标记以后依然超过了三十四个字的上限所以要提醒一下才对吧对吧对吧{/big}"]],
      next: "c1_late" },
    c1_late: { scene: "place_a", set: "f_late", shot: "这里才设 f_late", lines: [["", "现在才设。"]], next: "c1_judge" },
    // 埋错 W6：按好感判定，不够直接 retry
    c1_judge: { scene: "place_a", shot: "判定", branch: [{ need: ["a>=5", "f_pickA"], next: "c1_end" }, { next: "c1_fail" }] },
    c1_fail: { scene: "black", shot: "失败", lines: [["", "好感不够，重来。"]], next: "c1_fail2" },
    c1_fail2: { scene: "black", shot: "失败", lines: [["", "再来一次。"]], end: { type: "retry" } },
    c1_end: { scene: "place_a", shot: "结束", lines: [["", "第一章结束。"]], end: { type: "chapter" } },
  },
});
