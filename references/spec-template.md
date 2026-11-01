# 四件套怎么写

SPEC.md、registry.js、ch1.js 每个游戏自己写；校验器 `tools/validate.js` 从 skill 的 `scripts/` 拷来，不改代码。四样齐了才能并行写章节：子 agent 只看得到 prompt 和这几个文件，这里没写清楚的，每个子 agent 会各猜一种。

下面的格式示范全用占位符（`<…>`）。占位符不是建议：场景、人物、台词都按本作的构思现写。

## 1. story/SPEC.md（写作规范，给每一章的作者）

开头写一句「设定以本文件为准」，并指向 `references/character-writing.md`（子 agent 要读它）。下面几节按结构取舍。人物、台词、演出、好感的规则都在 character-writing，SPEC 只写本作的内容和例外。

0. 指纹：`ideation.md` 那张表，本作这一行。后面每一节都要对得上它
1. 核心设定
   - 地点（列出所有场景）、时间
   - 主角卡（character-writing §1.3），含视角
   - 世界规则：推动剧情的外部压力，从本作的人物和地方里来
   - 已发生事实表（写完第一章就补，之后每章交回再补；后面章节的作者靠它衔接）：`事实 | 节点 | 哪些路径一定发生 | 相关 flag`
2. 人物表：每个重点角色一张，照 character-writing §1.1 填（必填五行，可选的按构思挑），再加服装；下面放差异化检查（§1.2）；配角照 §1.4 加一行「功能」
3. 声音卡和呼称表：每个说话角色一张（主角、旁白也要），全作一张呼称表，格式见 character-writing §2。子 agent 必读，审读对照
4. 数值
   - 有哪些数值、跨不跨章；加减口径照 character-writing §5.2，这里只写本作的例外
   - 各判定点到达时数值的范围（`solve.js --vars <判定节点>` 实测，写进来）
   - 结局形状是分好坏的，门槛用 `solve.js --odds <章末判定节点>` 验两条：
     - 本章开头数值最低的玩家全选对，能到好的那个
     - 本章开头数值最高的玩家随机选，进好的那个 ≤ 40%（估计）
   - 别的结局形状（分方向、余味、开放）写清每个结局的条件，用 `--endings` 验都走得到
5. 各章（分院帽是各条线）的大纲：先写选的弧形（character-writing §5.1），再写一张分场表
   - 每场一行：`场 | 场景 / 时段 | 在场 | 发生什么 | 伏笔埋 / 收 | 关键台词（≤1 句） | 数值点`
   - 写清这种弧形自己的要点怎么落地、解法来自哪个伏笔、结局是什么形状（genres.md「结局的形状」）
   - 各章（各线）的弧形不全一样
6. 伏笔表：`伏笔 | 埋在哪个节点 | 哪些路线看得到 | 在哪回收 | 回收前玩家该有的感觉`
   - 主 agent 写第一章时登记；子 agent 在回复里报本章新埋的，主 agent 补进来
   - 选项文字承诺了的事也记一行（在哪兑现）
   - 几章共用的固定事实（某段原文、某个时间点）写死在这里，各章一字不差
7. 线索、循环类才要：真相（作者全知）、默认时间轴（时间 | 地点 | 事件）、线索表
8. 文件格式：照下面「节点格式」抄进来，把场景、说话人、表情、表情符号、配乐、环境音、音效、转场的可选值列在注释里
9. 写作要求，都写成能检查的数字
   - 每行台词 40 字、旁白 30 字为目标（validate 在 `LINT` 的 44 / 34 提醒）
   - 每章节点数、时长、选择点数、限时次数、CG 张数、换装次数、两人同屏次数
   - 选择间隔：平均 25–50 行一个，最长不超过约 80 行（推算）
   - 开场：第一章开头约 40 句内出第一个选择
   - 旁白占比、省略号、演出和声音的用量照 character-writing §2–§4，本作有例外写在这
   - 写完跑 `node tools/validate.js story/chN.js`，0 错误才算完
10. 美术说明：立绘能表现什么（表情、表情符号、姿势、一次性动作），每个角色常用哪几个姿势；有哪些 CG

### 节点格式

```js
STORY.chapter({
  id: "ch2", title: "<章名>", loop: 2,
  start: "c2_open",
  nodes: {
    c2_open: {
      scene: "<场景id>",                  // 必填，registry 的 SCENES；cg_ 开头的是 CG（不画立绘）
      trans: "dissolve",                  // 转场，可选：不写时场景变了用 R.DEFAULT_TRANS，没变不转场；
                                          //   cut dissolve black white wipe-l wipe-r wipe-u wipe-d iris blinds pixel eye-open eye-shut，或 { kind, ms }
      tod: "<day|sunset|night>",          // 时段变了才写
      weather: "<clear|rain>",            // 天气变了才写
      props: { <开关名>: 1 },             // 场景开关（灯、门……），registry PROPS 登记
      time: "<HH:MM>",                    // 可选，时间变了才写
      day: 2,                             // 可选，一章跨好几天时给工具排时间用；HUD 默认不显示第几天，写了 R.DAY_LABEL 才显示
      bgm: "<曲名>", sfx: "<音效>", fx: "shake", // bgm 也可以写 "none"（3 秒淡出）或 { id, fade }（淡入秒数）
      bgmVol: 0.5,                        // 可选：压低音乐，到下一个写了 bgm 的节点恢复
      amb: "<环境音>",                    // 沿用到下次改，"none" 停；每章开头清零
      stage: { l: "<id>:<表情>#<姿势>", r: "<id>@<服装>" }, // 站位：l c r（ll rr）；写了就整体替换，{} 清空
      title: ["<标题>", "<副标题>"],       // 可选：章首标题卡
      shot: "<镜头描述，一句话>",           // 必填
      lines: [
        ["<id>", "<台词>", "<表情>", "<表情符号>"],          // [说话人, 文本, 表情?, 表情符号?]
        ["<id>", "<台词>", "<表情>", { emote: "<…>", pose: "<…>", act: "<…>" }],
        //   第 4 项也可以是对象：emote pose act who off sfx fx outfit weather props stage enter exit amb bgm need needNot
        ["", "<旁白：某人的动作>", null, { who: "<id>", pose: "<…>" }], // 旁白写谁的动作：who = 谁在动
        ["", "<旁白>", "", { weather: "rain", sfx: "<…>" }],              // 节点中间变天、关灯，写在台词上
        ["", "<旁白：冲击>", null, { fx: "shake2" }],                     // 震屏、闪白落在描写冲击的那一行
        ["<id>", "<台词>", "<表情>", { stage: { l: "<id>", r: "<id2>" }, enter: "right" }], // 从画外滑进来；exit 同理
        ["<id>", "<只在某条来路上说的台词>", "<表情>", { need: ["f_<…>"] }], // 条件台词：不满足整行跳过
        ["<id>", "{slow}<…>{/slow}{w}<…>{big}<…>{/big}", "<表情>"],       // 文字标记
        ["<id>", "<画外的声音>", "<表情>", "off"],
        ["", "<旁白>"],
        ["me", "<主角说出口的话>"],
      ],
      add: { <数值>: 1 },                  // 可选：进节点就加减
      clue: "<线索id>", set: "f_<…>",      // 可选：线索；flag（f_ 本章有效，g_ 全局有效）
      // 四种结尾选一种
      next: "c2_<…>",
      // choices: [{ t: "<选项>", next: "c2_<…>", add: { <数值>: 2 }, clue, set, need: ["<数值>>=5", "g_<…>"], needNot: ["f_<…>"] }],
      //   限时：timer: 8, timeout: { next: "c2_<…>", add, set }（超时走 timeout；不写才退回第一项）
      // branch: [{ need: ["<数值>>=12"], next: "c2_<…>" }, { next: "c2_<…>" }],   最后一项必须无条件
      // end: { type: "chapter", id: "ch3" }（进指定章；不带 id 按 FLOW）/ { type: "retry" } / { type: "ending", id: "E1" }
    },
  },
});
```

- `need` 里可以混写线索、flag 和比较（`a>=5`、`a>b`、`a==0`），全部满足才显示该选项、走该分支、说这一行台词；`needNot` 任一满足就隐藏
- 条件台词用在汇合节点：几条路汇到同一个节点，来路不同要说的话不同，加一行带 `need` 的台词，不必拆节点
  - 回应「刚才选了哪项」的台词，按那个选项 `set` 的 `f_` 分，不按好感值分：前面别的选项也加分，好感值够了不代表刚才选的是这一项；validate 会提醒
  - 好感值只用在「关系到了没有」的判断上；`solve.js --merge` 能看到每条来路的好感范围，两条来路的范围重叠就不能拿好感值分
- 文字标记：`{w}` 停 0.5 秒、`{w=1.2}` 停 1.2 秒；`{slow}…{/slow}` 每字 150 ms、`{slow=300}` 自定；`{big}` 1.5 倍字、`{red}` 警示色、`{shake}` 抖字，都要成对。记录、存档、配音、字数统计用去掉标记的纯文本
- 节点 id 带章节前缀（`c2_`），全局唯一；章节 id 用数字（ch1、ch2…）

## 2. story/registry.js（登记表，引擎和校验器共用）

- `TITLE`：name（也是存档命名空间，换游戏一定要改）、sub、eyebrow、标题页的 scene（封面，见 SKILL 美术一步）和 tod
  - `cw`：内容提示，大类数组，标题页一个按钮展开、默认收起；空数组不显示。写什么开工时问用户
  - `credits`：制作说明，必填（SKILL 红线「AI 标注」）：剧本由 <模型名> 生成；画面全部用代码绘制，没有使用生图模型；配乐用 WebAudio 合成；配音为 TTS 合成（没配音就删掉这句）
- `SCENES`、`TODS`、`WEATHERS`、`PROPS`（场景开关：`{ 名字: "说明" }`）
- `DAY_LABEL`：HUD 上「第几天」的格式（如 `"第 {d} 天"`）；不写或 `false` 就不显示，只显示钟点
- `TRANS`、`DEFAULT_TRANS`（默认 `{ kind: "dissolve", ms: 400 }`）、`AMB`（和 `music.js` 对上）
- `SPEAKERS`：每人 `name`、`portrait`（`pixel_art.js` 的 CAST id）、`voice`（TTS 音色，null 不配音）、`color`（名牌颜色）
  - 同一个人物在主角知道名字前后显示名不同，就写两个说话人 id 共用一个 `portrait`
- `OUTFITS`：每个角色有哪些服装（和 `pixel_art.js` 的 outfits 对上，校验器靠它查）
- `EXPRS` `EMOTES` `BGM` `SFX` `FX`：和美术、配乐引擎里的名字对上；`FX` 有 shake shake2 hshake white black red clear flash fade（red 一直保持到 clear 或换章）
- `VARS`：数值，`{ <id>: { name, init, mark } }`（不一定是好感）；`SHOW_AFFECTION` 要不要在数值上升时弹提示，`mark` 是提示前面的记号（默认「+」）
- `METERS`：可选，要常驻 HUD 的数值仪表 `[{ var, label, scale, unit, digits, warn, need }]`（engine-notes「数值仪表」）
- `CLUES`：线索类才用，每条 `ch`（首次能拿到的章节号）、`name`、`desc`（线索本原样显示）
- `ENDINGS`、`CHAPTERS`（`label` 可选，覆盖标题卡的「第 N 章」）
- `FLOW`：主干按顺序；分院帽分出去的线不写进来，由章末跳转进入
- `LINT`：`maxLine` / `maxNarr` 字数提醒线（默认 44 / 34，写作目标 40 / 30），`banned` + `bannedWhy` 禁用词，`dayStart` 跨午夜（夜戏演到天亮的设 "12:00"），`firstChoice` 第一章开头到第一个选择最多几句（默认 40）
  - starter 的 `banned` 已带翻译腔正则，`bannedWhy: "翻译腔"`：`(的说|呐[，。！？]|酱[，。！？]|桑[，。！？]|如果是.{1,6}的话|给你看)`；会误报，只当提醒；人设需要的词从正则里删掉
- 子 agent 不许改它：要新场景、新音效就在回复里提，由主 agent 统一加

## 3. tools/validate.js（校验器）

直接用，不用改代码。它查：

- 结构：只调用一次 `STORY.chapter`、start 存在、id 有前缀、四种结尾恰好一种、branch 最后一项兜底
- 引用：场景、时段、说话人、表情、表情符号、站位里的角色和服装、数值、比较条件的写法、线索、BGM、环境音、SFX、FX、转场、结局、跳转的章节；台词第 4 项的键和取值
- 图：从 start 到不了的节点（提醒）、走进去就到不了 end 的节点（错误）
- 跨章：线索在后面章节才发、本章发得太晚都报错；还没写出来的章节跳过
- flag：条件里读了却没人 `set`（错误）；`set` 了却没人读（提醒）
- 限时：没写 `timeout`、`timer` 不在 5–10 秒（提醒）
- 文字标记是否成对；量字数前先去掉标记
- 节奏：第一章开头到第一个选择超过 `LINT.firstChoice` 句；数值比较后面直接 `end: retry`；一章平均不到 15 行就换一次 BGM、整章没有 `bgm: "none"`（都是提醒）
- 汇合处按好感值分台词（提醒）
- 钩子：标题副标题、章名里数天、倒计时（提醒，`defaults-check.md`）
- 时间倒退（按天 + 钟点，提醒）、台词超长、命中禁用词（提醒）
- 全量跑时：登记了却走不到的章节、登记了却没人加减的数值（提醒）

## 4. story/ch1.js（第一章，也是示范章）

- 主 agent 自己写。它是格式示范，也是语气参考：子 agent 会照着它的旁白长度、台词口吻、表情和表情符号的密度写
- 开场约 40 句内出第一个选择
- 字段都用一遍：stage（带 #姿势）、enter / exit、tod、trans、表情符号、pose、act、who、off、fx、bgm（含一次 `"none"`）、amb、文字标记、条件台词、add、choices、branch、end；限时选择只在故事真有时间压力时用
- 写完先过 validate；有数值判定的，用 `solve.js --vars <判定节点>` 量出范围，把门槛和各章开头的范围写回 SPEC；补好已发生事实表和伏笔表，再派子 agent
