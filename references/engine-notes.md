# 引擎三件怎么用、怎么改

三个文件：`index.html`（游戏引擎）、`pixel_art.js`（美术引擎）、`music.js`（配乐引擎）。纯 JS，不用框架、不用构建，浏览器直接打开 `index.html` 就能玩。skill 的 `assets/starter/` 里都有现成的，开工直接拷。

| 文件 | 换游戏时改什么 |
|---|---|
| `index.html` | 一般不改代码；每加一章加一行 `<script src="story/chN.js">`；`<title>` 改成游戏名；`:root` 的 `--accent` 是中性占位色，换成本作主色 |
| `pixel_art.js` | `CAST` 角色、`SCENES` 场景（含 `cg_` 开头的 CG）、`OUTDOOR` 室外场景；色表不够就往 `PAL` 里加。starter 的 3 个角色和 `place_a` `place_b` 两个灰盒场景都是占位，整份换掉 |
| `music.js` | `TRACKS` 曲目、`SFX` 音效 |
| `art.html` | 不用改：直接读 `pixel_art.js` 和 registry |
| `story/registry.js` | 整份换成自己的 |
| `story/SPEC.md` `story/ch1.js` | 填空版规范、占位示例章，整份换掉 |

## 引擎能做什么（galgame 版）

| 功能 | 剧本里怎么写 | 说明 |
|---|---|---|
| 多人同屏 | 节点 `stage: { l: "a:smile", r: "b@alt" }` | 位置 l / c / r（还有 ll / rr）；写了就整体替换，`{}` 清空，不写沿用。新来的淡入、走的淡出；同一人换了位置 320 ms 滑过去 |
| 进出场 | 和 `stage` 一起写 `enter` / `exit: "left"`（或 `"right"`），节点和台词第 4 项都行 | 新上场的人从画外这一侧滑进来；离场的人往这一侧滑出去；同一个人换位置时 320 ms 滑过去 |
| 转场 | 节点 `trans: "iris"`，或 `{ kind, ms }` | cut dissolve black white wipe-l wipe-r wipe-u wipe-d iris blinds pixel eye-open eye-shut；不写时场景变了用 `R.DEFAULT_TRANS`（默认溶解 400 ms），场景没变不转场；场景没变但写了 `trans` 照样转（表示时间跳过）；快进、读档时一律 cut。默认时长：dissolve 400、black / white 900、wipe 500、iris 700、blinds / pixel 600、eye-open / eye-shut 1400 毫秒；`wipe-r` 是边界从左往右扫 |
| 震屏、闪白 | 节点 `fx`，或台词第 4 项 `{ fx: "shake2" }`（这一行开始时触发） | shake、shake2（加倍，0.5 秒）、hshake（只横向）、white black flash（闪白、闪黑）、red（整个画面压一层警示色，一直保持，到 `clear` 或换章才消；要一闪而过的用 flash）、clear、fade；设置里「减少闪光与震屏」打开时只做很弱的版本或不做 |
| 文字标记 | 台词文本里写 | `{w}` / `{w=1.2}` 停顿，`{slow}…{/slow}` / `{slow=300}` 慢打，`{big}` 1.5 倍字，`{red}` 警示色，`{shake}` 抖字；点击跳过时带样式一次显示完；记录、存档、配音、字数统计用纯文本 |
| 条件台词 | 台词第 4 项 `{ need: ["f_x"], needNot: [...] }` | 写法和选项条件一样；不满足整行跳过：不显示、不进记录、不触发这一行的 pose / act / stage |
| 说话人高亮 | 自动 | 说话的人亮，其他人压暗；旁白、画外音时都不压暗。说话的人不在台上会自动站到空位 |
| 表情 | 台词第 3 项 | 10 种：neutral smile grin shy pout angry sad cry surprise smug |
| 眨眼、口型、呼吸 | 自动 | 每人 2–6 秒随机眨一次；打字机走字时说话的人嘴一开一合；呼吸、头歪、身体轻摆、后发钟摆都是连续的（见下面「动起来」）；开口那一下头轻点一下 |
| 姿势 | 站位 `"a:smile#hip"`，或台词第 4 项 `{ pose: "hip" }` | rest 垂手、hip 叉腰、chest 按胸口、mouth 捂嘴、think 托腮、wave 挥手（会动）、point 指、cheer 握拳加油（会动）、cross 抱臂、hold 双手捧着 item、shrug 摊手、clasp 合握、salute 敬礼、grip 单手在身侧握着 item。换姿势时手臂 0.26 秒走过去；沿用到下次改，每章清零 |
| 一次性动作 | 台词第 4 项 `{ act: "nod" }` | nod 点头、shake 摇头、jump 蹦、hop 连蹦两下、shiver 发抖、bow 鞠躬 |
| 旁白里的动作 | `["", "<旁白：某人的动作>", null, { who: "<id>", pose: "<姿势>" }]` | who = 谁在动，不会变成说话人；旁白写了 pose / act 没写 who，validate 报错 |
| 表情符号 | 台词第 4 项 `"heart"`，或 `{ emote: "heart" }` | exclaim question sweat anger heart note dots sparkle gloom，冒出来时有一声 pop |
| 画外音 | 第 4 项 `"off"` | 电话里、门外、喇叭里 |
| 换装 | `stage` 里写 `@服装名`，或第 4 项 `{ outfit }` | 服装名在 `pixel_art.js` 的 `outfits` 和 registry 的 `OUTFITS` |
| 时段 | 节点 `tod: "sunset"` | day / sunset / night，整个画面连立绘一起调色；沿用到下次改 |
| 第几天 | 节点 `day: 2`（配 `time`） | 给工具排时间（换天不算时间倒退）；HUD 默认只显示钟点，registry 写了 `DAY_LABEL`（如 `"第 {d} 天"`）才显示第几天 |
| 天气 | 节点 `weather: "rain"`（台词第 4 项也能写，节点中间变天） | clear / rain：有窗的场景窗外下雨、室外场景（`OUTDOOR`）整片下雨，画面略压灰；沿用到下次改，配 `sfx: "rain"` |
| 场景开关 | 节点 `props: { <开关名>: 1 }`（台词第 4 项也能写） | 灯、门、屏幕这类能开关的东西；registry `PROPS` 登记，场景 draw 里读 `o.props`；每章清零，沿用到下次改 |
| CG | 场景 id 用 `cg_` 开头 | CG 时不画立绘、不做时段调色（光线自己画）；看过的进标题页「回想」 |
| 配乐 | 节点或台词第 4 项 `bgm: "sad"`；`"none"` 3 秒淡出；`{ id, fade }` 淡入 fade 秒；节点 `bgmVol: 0.5` | `bgmVol` 压低音乐，到下一个写了 `bgm` 的节点恢复 1 |
| 环境音 | 节点或台词第 4 项 `amb: "<环境音>"`，`"none"` 停 | 和 BGM 分开的一路，换的时候交叉淡化 1.5 秒；沿用到下次改，每章开头清零；`weather: "rain"` 且没写 `amb` 时自动接 rain |
| 好感 | 节点或选项 `add: { a: 2 }`；条件 `need: ["a>=5", "a>b"]` | registry `VARS` 登记；跨章保留，新游戏归零；`SHOW_AFFECTION: true` 时好感上升弹「♥ 名字」 |
| 数值仪表 | registry `R.METERS = [{ var, label, scale, unit, digits, warn, need }]` | HUD 时间下面常驻显示几个数值：`S.vars[var] × scale` 按 `digits` 位小数加 `unit`；到 `warn` 变警示色；`need` 写条件（和台词同写法），满足才显示。数值是玩家要盯着做决定的资源时用（钱、体力、时间……）；validate 查 var 登记了没有 |
| 跳章 | 章末 `end: { type: "chapter", id: "<章>" }` | 跳到指定章（分院帽进线用）；不带 id 就按 `FLOW` 走下一章 |
| 失败重来 | `end: { type: "retry" }` | 标题卡「再来一次」；回到章首快照的好感和 `g_` flag，线索保留（悬疑靠线索跨轮）。只给剧情里明确的失败用，好感不够要有出口（genres.md） |
| 限时选择 | 节点 `timer: 8` + `timeout: { next, add, set }` | 超时走 `timeout`；没写才退回第一项（旧行为）。菜单、记录这类浮层打开时倒计时（连同倒计时条）暂停，浮层开着点不了选项；设置里可选「正常 / 时间加倍 / 不限时」 |
| 线索 | 节点或选项 `clue` | 可选；`CLUES` 为空时 HUD 不显示线索按钮 |
| 自选章节 | `FLOW` 里写 `{ pick: [...], title, desc }` | hub 页 |
| 章节重玩 | 不用写 | 首次进入某章时存快照（好感、线索、flag、已完成章节）；重玩这章、从章节页进入都先全部恢复，好感不会加两遍；快照另抄一份到 `meta.snap`，新游戏后从章节页进也用得上 |
| 系统 | 不用写 | 自动存档 + 6 格手动存读档、快进（按住 Ctrl）、自动播放、记录（滚轮上 / PageUp 打开）、隐藏界面（H）、静音、右键打开菜单、CG 和结局回想 |
| 存档失败 | 不用写 | 写不进去（隐私模式、空间满）时提示「存档失败：浏览器不允许本地存储或空间已满」，不再说已存；启动时试写一次，不可写就在标题页常驻提示 |
| 确认 | 不用写 | 有续档时点「新游戏」、手动档覆盖已有档时，先弹页内确认层 |
| 设置 | HUD、菜单、标题页的「设置」 | 文字速度（含瞬间）、自动速度、BGM / 音效与环境音 / 语音三路音量（BGM、音效默认 75%，语音 100%）、字号 100–200%、对话框不透明度、减少闪光与震屏、限时选项（正常 / 时间加倍 / 不限时；不限时就走不到 `timeout`）、快进范围（只已读 / 全部）；存在 `vg:<游戏名>:prefs`，键名 `cps auto bgm sfx voice fontScale boxAlpha calm timer skipAll` |
| 标题页 | registry `TITLE.cw` `TITLE.credits` | 「内容提示」按钮（`cw` 非空才显示，点开列出）；「制作说明」（剧本、画面、配乐、配音分别怎么来的） |
| 封面 | registry `TITLE.scene` 指向一张封面场景；`index.html` 里加 `<style id="titleCss">` | 标题页背景就是这张场景（会动）；`#title` 是 flex 列，`h1` `#tSub` `.eyebrow` `.row` 用 `order` 排，竖屏用 `@media (max-aspect-ratio: 1/1)` 单独排 |
| 手机竖屏 | 自动 | HUD 只留记录 / 自动 / 快进 / 菜单，其余收进菜单；按钮、选项最小高 44px；`touch-action: manipulation` |

台词第 4 项一览：省略 / `"off"` / 表情符号名 / `{ off, emote, pose, act, who, sfx, fx, outfit, weather, props, stage, enter, exit, amb, bgm, need, needNot }`（`jump: 1` 还能用，等于 `act: "jump"`）。`stage` 写在台词上，就是这一句开始时换站位：节点中间有人跑掉、有人走进来，用它（某人离场的那一句写 `{ stage: {} }`，要往左出去再加 `exit: "left"`）。

横屏时选项排在画面上部（HUD 下面），避开立绘的脸（画面高度 41%–56%）；竖屏时排在对话框下面。立绘画布 240 高、在画面里只露上面 210（`VIS`，下面 30 像素在屏幕外），人往上站，胸前的手势落在对话框上面（对话框盖住画面 76%–97%）。

## 引擎接口（`tools/playtest.js` 靠这些驱动引擎）

自己改引擎时别删：

- 加载顺序：`pixel_art.js` → `music.js` → `story/registry.js` → 定义 `window.STORY = { chapters: {}, chapter(c) { this.chapters[c.id] = c; } }` → `story/ch*.js` → `audio/voice/manifest.js`（`onerror="void 0"`，可以没有）→ 引擎脚本
- 元素 id：`#bNew`（新游戏，`onclick` 开局）、`#choices`（`hidden` 表示没在选，`_vis` 放当前可见的选项）、`#ending`、`#hub` `#hubGrid`（自选章节页，可以不做）
- 全局函数：`choose(选项)`、`advance(fromAuto)`、`go(id)`（playtest 包一层算覆盖率）
- 引擎主脚本里有 `function boot`，同一个脚本作用域里有 `S`（`node` `line` `clues` `done`）和 `meta`（`endings`）
- 定时器只用 `setTimeout`，而且只给一次性的事用（打字机、标题卡、限时、自动播放）。眨眼、口型、进退场、滑动、转场这些持续的动画放在画面循环里按时间算，不要用 `setTimeout` 链：playtest 用假定时器一个个冲掉，循环的定时器会让它死循环
- 存档：`store.set` 返回成败，失败必须告诉玩家，别提示「已存到」
- 确认用页内的 `#confirmOv`，不用 `window.confirm`：playtest 和 browser_play 都处理不了原生对话框
- 设置浮层 `#prefOv`（`#prefList`，选项按钮带 `data-pref`）；确认层 `#confirmOv`（`#cfMsg #cfSub #cfYes #cfNo`）；标题页 `#bTPref #bCw #bCredits`；章节快照在 `S.snap[章id]`
- `choose` 在浮层打开时、或选项不在当前 `#choices._vis` 里时不响应（防连点）；工具从 `_vis` 取选项
- 有可续档时点 `#bNew` 先弹 `#confirmOv`，自动化要点 `#cfYes`（browser_play 已处理）
- 存档里多存了 `S.bgm` `S.vol` `S.amb`，读档时音乐、音量、环境音原样接上

## pixel_art.js（美术引擎）

画面 480×270；立绘设计宽 112、高 240（拼好的 160 宽），在画面里露出上面 210（下面 60 像素多半在对话框后面，手势都放在胸口以上）。浏览器里挂 `window.PixelArt`，node 里 `module.exports`，`tools/render_png.js` 能直接渲染成 PNG。

- 角色 `CAST`：参数化生成，不画一张张图
  - `hair` long / bob / twintail / ponytail / sidetail / short，`bangs: "blunt"` 齐刘海，`ahoge` 呆毛
  - `hairC` black brown blonde pink silver blue red violet；`eyeC` blue green amber violet red brown grey
  - `outfits: { 名字: { type, main: [深, 中, 浅], acc, tie } }`，type 是引擎自带的几种衣服（sailor / blazer / sweater / hoodie / gakuran / shirt），只当画法参考；本作的衣服按设定往 `OUTFITS` 加新的
  - `male: 1` 男生体型和眼型；`acc` glasses / earrings；`ribbon` `pin` `headband` 发饰颜色
  - `age`：数字，照人物表填，必填。胸的体积明暗默认只给 `age >= 18` 的女性角色；未满 18 或没写 `age` 的不画；`bust` 显式写了以显式为准（sprite-art §4）。starter 的 3 个占位角色都写了 25 岁，两个女性角色按默认画
  - `expr: { neutral: { mouth: "small" } }`：覆盖某个表情的局部，做出个人特点（平时就抿嘴、天生带笑）
  - 参数不够用就在 `outfit()` `hairBack()` `hairFront()` 里加 case
- 绘制流程 `bust(角色, 表情, { blink, talk, outfit })`：后发 → 脖子 → 衣服 → 脸 → 眼 → 鼻嘴 → 腮红 / 眼泪 → 前发（先在额头投影）→ 眉 → 眼镜 → 发饰 → 外轮廓；结果按参数缓存
  - 正脸，中线是第 56 列（x 和 112 - x 互为镜像）。左右对称靠画法保证，不靠手算坐标：
    - 脸、衣服、头发的对称部分只画左半边，再 `mirrorHalf(层)` 抄到右边；嘴也画在自己的层里再镜像
    - 眼睛、眉毛、腮红、眼泪、镜框用 `mirrorPen(b)` 把左边那份原样画到右边；眼珠往哪看、高光在哪由参数换算，两只眼方向一致
    - 不对称的东西最后单独画：`hairBackExtra`（马尾）、`hairFrontExtra`（分缝刘海、亮面、呆毛）、`outfitExtra`（胸袋），以及光照阴影
    - 自查：放大图里左右眼、嘴角、下巴、脖子、领口要落在同一条竖线两侧
  - 分层：后发、衣服、前发用 `layer(draw, lit, mul, 勾边色)` 画在自己的缓冲里，阴影和勾边只作用于这一层
  - 阴影是赛璐璐硬边：头发、后片用 `PB.cel(lit, mul)`（`lit` 是偏左上的椭圆 `litEll`，乘数在 `CEL` 表）；衣服用 `formShade`（躯干圆筒 + 女生胸的两个球，见 sprite-art §4）。脸单独画：背光一侧的脸颊一条、刘海下面 3 像素、下巴在脖子上投一块，都是硬边
  - 头发 4 个色阶 `ramp()`：D 发丝线、MD 后发、M 本色、LM / L 头顶左上的亮面（下沿锯齿）
  - 勾边：`edge()` 用本色的深暖色勾每一层的边，`selout()` 在整张立绘外加一圈相邻色的深色，不用纯黑
  - 头发：`strand()` 画一束（二次曲线、根粗尖细，`p` 越大越晚收尖），刘海是 `hairFront()` 里的 `tips` 表（每束尖的位置、长短、宽、往外扫），发束之间的线也用 `strand()` 画，中间粗两头细
  - 脖子画在衣服后面，领口开多大就露多少
- 场景 `SCENES[id] = { name, draw(b, t, o) }`：`t` 秒数做动态（粒子、灯闪、雨），`o.tod` 时段；零件在 `parts`：`sky` `windowRow`（会按 `o.weather` 在窗里下雨）`floorPlanks` `glow` `particles` `rainIn`（在一块矩形里下雨）`bigBust`（CG 里把立绘按倍数放大贴上去）
  - 场景里有窗就用 `rainIn` 画窗外的雨；室外场景加进 `OUTDOOR`，下雨时整片下
- 合成 `frame(场景, t, { chars: [{ id, pos, ex, outfit, blink, talk, pose, poseFrom, poseK, act, actT, dim, alpha, dy, emote, emoteT }], tod, red })`
- 立绘是四层每帧现拼的（`compose(角色, 状态, t)`）：后发、身体（脖子 + 衣服）、手臂、头（脸 + 五官 + 前发 + 帽子）
  - 后发、身体、头按参数缓存，手臂每帧画：上臂、肘、小臂、手腕按 `ANAT` 两侧宽度曲线画成一整条、只勾外轮廓（小臂叠在大臂前面才补内线）；手默认顺着小臂（`hd` 可以折手腕），手型见 sprite-art §6
  - 姿势直接写手肘和手腕的位置（`e` 相对肩关节、`w` 画面坐标），像画师摆姿势；手在胸前时小臂朝镜头、画面上变短，手肘就写在腰边
  - 拼好的立绘 160 宽（设计画布 112，左右各留 24），手肘伸得出去；对外的 `SW` 是 160，`DW` 是 112
  - 身体比基准宽 `BODY_K` = 1.3 倍：衣服按基准宽度写，`bodyPen` 画的时候横向撑开（肩宽约是头宽的 1.3–1.6 倍，不然像大头娃娃）
  - 描边做 Pixel Perfect（`edge()` 去掉台阶拐角多出来的那个像素）；衣服在阴影之外还有一块左上的亮面（`OUTFITS[type].shine`，布料 0.07、盔甲调大）
  - `PB` 记着画到过的范围（`bx0..by1`），描边、阴影、贴图只扫这一块；直接改 `d` 的函数要调 `touch()`。三人同屏一帧约 46 毫秒（node）
  - 动起来照 Live2D 的思路：`params()` 每帧算几个参数，头、身体、后发三层按参数「绕支点转一个小角度 + 不到 1 像素的平移」贴上去
    - 头的倾斜：待机时慢慢歪来歪去（两个正弦叠起来，±2° 左右）；换表情时歪向 `EX_TILT` 里的角度（害羞 5°、得意 −3°……），带回弹；说话时轻轻摆
    - 身体：绕胯轻轻摆 ±0.5°；呼吸 3.6 秒一次，肩和头跟着往上提不到 1 像素
    - 后发是钟摆：跟着头和身体转，晚 0.18 秒、甩过头一点再回来（`hair`）
    - 一次性动作都有预备和回弹：蹦之前先蹲、落地再压一下；点头先微微抬再点；摇头是转着晃
    - 换姿势：手腕绕肩走弧线，`easeOutBack` 到位时过头一点再回来
    - 转图用 RotSprite 的办法（`epx2` 放大 4 倍缓存，`drawXform` 按旋转后的坐标取样）：线条不断、不加新颜色；平移按 1/4 像素取样，动起来是连续的
    - `index.html` 传 `exFrom` / `exT`（换表情的时刻）、`speaking`；`bust()` 是 `still` 的静态帧
  - `bust(角色, 表情, { pose })` 是静态的一帧，给缩略图、CG、导出 PNG 用
- 新题材加东西，在游戏的 `pixel_art.js` 里往表里加一项，不用改 `bust()`：
  - 衣服 `OUTFITS[type] = { draw(b, s, o) 画左半边, extra(b, s, o) 只在一边的东西, back(b, s, o) 躯干后面的后片, shine 亮面强度, sleeve(o) }`
    - `sleeve(o)` → `{ c, d, cuff, bell 喇叭袖, frill 喇叭袖内衬, pad 垫肩, roll 卷到肘上露出小臂, bracer [色, 线] 护腕, glove [色, 暗] 手套 }`
    - 盔甲胳膊加 `armor: 1` 和 `pauldron [色, 亮, 缝, 片数]`、`mail [色, 色]`、`couter [色, 亮]`、`vambrace [色, 亮, 暗]`
    - 衣服的侧边用 `edgeAt(s, y, 外扩)` 取身体在这一高度的边（女生沙漏、男生倒三角，表在 `BODY`），腰带放在 `WAIST`；别写死 x，身体一改衣服就对不上
  - 手里的东西 `ITEMS[名字] = (b, x, y, t, how)`：how = "both"（hold，两手中间）/ "one"（grip，右手）；长的单手竖在身侧，双手拿时横过来或朝下，别挡脸
  - 姿势 `POSES[名字] = { l, r: { e: [往外, 往下], w: [x, y] 或 t => [x, y], h: fist / palm / point / relax / flat / hide, t: 拇指 in / out / up / down, back: 1 手背朝前, hd: [dx, dy] 手腕折过来后手指的方向, front: 1 画在脸前 }, item }`
  - 角色参数还有：`ears`、`hat`（`hatC` `hatBand` `hatGem`）、`item`；现有取值看 `pixel_art.js`，本作需要的往里加
  - 加完的名字同时登记进 registry 的 `POSES` `ACTS`；validate 会核对 registry 和 `pixel_art.js` 对不对得上

画角色：脸、身体轮廓、体积明暗、胳膊、手（拇指朝向）、衣服、帽子、姿势怎么画，丑点和原因，自查清单，都在 `references/sprite-art.md`。下面是零散的几条：
- 看图要两种尺寸都看：`closeup` 放大 4 倍查细节，`stage.png` 按游戏里的大小看整体
- 双马尾、马尾的发尾别甩出 112 像素宽的画布，会被切掉；画完 `render_png` 看一眼边缘
- 人物身上不用抖动；抖动只留给天空、地面这类大面积渐变
- 深肤色时阴影要比肤色再深一档，否则鼻子和嘴看不见
- 同屏的两个人要从剪影上就分得开：发型、发色、眼镜、帽子，至少差两样
- 透视场景（走廊）地面要整片铺满、线条收向消失点；只画一块梯形会像小山

## music.js（配乐引擎）

`window.Music = { play(name, fade), vol(v, sec), amb(name), sfx(name), setVolume("music" | "sfx" | "amb", v), setMuted(m), muted, unlock() }`，WebAudio 现场合成。

- 曲目 `TRACKS`：一首 = 每小节一个和弦 + 8 拍节奏型 + 乐器（piano / pluck / bell）+ 可选 bass、pad、pulse。starter 的 `t1`…`t6` 只是能跑起来的示范，按本作重写
  - 配几首、什么时候换、什么时候静音：character-writing §4「声音」
- 音效 `SFX`：click door chime（四音钟声）bell（门铃）heartbeat pop（表情符号冒出来）whoosh rain（雨声）crowd（人群哄笑 / 鼓掌）glass；加一个就是在表里加一行函数，再到 registry 登记
- 环境音 `AMB`：rain cicada wind crowd night waves clock，噪声加滤波器合成、循环播放；独立一路增益，和 BGM 互不影响；加一个同样要到 registry `AMB` 登记
- `play(name, fade)` 换曲时旧曲淡出、新曲淡入；`vol(v, sec)` 是 `bgmVol` 用的压低音乐；设置页三路音量走 `setVolume`
- 浏览器要用户点一下才允许出声：第一次点击时调 `Music.unlock()`

## 工具（skill 的 `scripts/`，开工时拷进 `<游戏>/tools/`）

都按「本脚本的上一级」找游戏目录，也可以用环境变量 `GAME_DIR` 指定。

| 脚本 | 用途 |
|---|---|
| `validate.js [story/chN.js …]` | 剧本校验：结构、引用（场景、说话人、表情、表情符号、站位、服装、好感、线索、转场、环境音、FX）、可达性、能否走到结尾、跨章线索顺序、时间倒退、flag 读写配对、限时没写 timeout、文字标记成对、开场到第一个选择的句数、好感不够就 retry、BGM 换太勤或没有静音；全量跑时还查走不到的章节、没人加减的好感。逐项见 spec-template §3 |
| `solve.js --endings` / `<节点>` / `--vars <节点>` / `--odds <节点>` / `--merge` | 整局搜索（带着好感、线索、flag 跨章，`timeout` 算一个分支）：每个结局能否走到、最短路径、到达时的好感；有没有死路（某个到达的状态一个选项都不出来）；走不到的会一路往回指出卡在哪个条件；`--vars` 给出到达某节点时好感的取值范围，用来定门槛；`--odds` 从本章开头数值最低、最高两档出发，可见选项等概率随机走到判定点，报各分支概率和「全选最优能否进第一个分支」；`--merge` 列出入度 ≥ 2 的节点各条来路的 flag 差异、在场的人、好感范围，给审读用；`--routes` 输出每个结局最短选法的 JSON（playtest 结局直达用）；`--walk N` 在剧本模型上随机走 N 局，报各结局的随机到达率和一条路径（数值多、状态多时用）。去重时只算影响走向的 flag（选项、分支条件里出现的），只控制台词显示的 flag 不算 |
| `playtest.js [局数] [种子]` | 假 DOM 跑引擎，随机游玩：卡死、崩溃、结局分布、节点覆盖、漏加载的章节；走 timeout 分支；断言章节重玩不加两遍好感、存储写失败时出失败提示（引擎没这功能就跳过）；末尾按 `solve.js --routes` 的最短选法把每个结局在引擎里实跑一遍（结局直达）；有卡死、崩溃、断言失败时退出码 1 |
| `browser_play.py --out <目录> [--ch ch2] [--audit]` | 真浏览器自动通关（要装了 playwright 的 python）：页面报错、卡死、标题卡、截图；`--ch` 直接从某章开局，只测某一章（随机从头玩很难走到的章）；`--audit` 量每个可见按钮，小于 24×24 报错（退出码 1）、小于 44 提醒，宽度 ≤ 480 时默认开，`--no-audit` 关 |
| `render_png.js <目录> [场景…]` | 美术渲染成 PNG：角色 × 表情、动画帧和服装、表情符号、角色 × 姿势 + 动作帧（`poses.png`）、场景 × 时段、两人同屏 |
| `dump_story.js [ch1 …]` | 剧本压成紧凑文本，给审读 agent 读；台词条件、fx、转场、环境音、配乐都打出来 |
| `audio_smoke.js` | 假 AudioContext 跑一遍配乐、音效、环境音 |
| `fingerprint.js [游戏目录 …]` | 从剧本读结构指纹（形状、重点角色数、分线、结局、限时、定线限时、场景、CG、标题数天、曲目），和作品目录下的旧作比：结构撞了、曲目表重合、标题在数天都提醒；题材、人物这些读不出来的轴在 `FINGERPRINTS.md` 手填 |
| `extract_lines.js` / `tts_batch.py` | 抽要配音的台词（去掉文字标记）/ 批量配音（`TTS_CMD` 命令模板） |
