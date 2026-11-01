#!/usr/bin/env bash
# 工具埋错测试：bash run.sh [--browser]
#   每条期望 = 在某个夹具上跑某个工具，输出里要有（或不能有）某句话；E / W 编号对应 bad/story 里的「埋错」注释
#   夹具：good（新键全写对 + 当前新引擎）、bad（剧本埋错）、partial（有章节没写）、old（旧引擎）、badengine（故意改坏的引擎）
#   --browser 再跑两局真浏览器触控审计（每局一分多钟）
T=$(cd "$(dirname "$0")" && pwd)
S=${SK:-$(cd "$T/../scripts" && pwd)}
# node 18+ 要在 PATH 里
PY=${PY:-python3}  # --browser 要装了 playwright 的 python
OUT=$T/out; rm -rf "$OUT"; mkdir -p "$OUT"
$PY "$T/make_engines.py" || exit 1
pass=0; fail=0
run() { local name=$1 dir=$2; shift 2; (cd "$T/$dir" && GAME_DIR="$T/$dir" "$@" > "$OUT/$name.txt" 2>&1; echo $? > "$OUT/$name.code"); }
ok() { pass=$((pass + 1)); echo "  ✓ $1"; }
no() { fail=$((fail + 1)); echo "  ✗ $1"; }
has() { if grep -qF -- "$3" "$OUT/$1.txt"; then ok "$2"; else no "$2：$1 的输出里没有「$3」"; fi; }
hasnt() { if grep -qF -- "$3" "$OUT/$1.txt"; then no "$2：$1 的输出里不该有「$3」"; else ok "$2"; fi; }
code() { local c; c=$(cat "$OUT/$1.code"); if [ "$c" = "$3" ]; then ok "$2"; else no "$2：$1 退出码 $c，应为 $3"; fi; }

echo "validate"
run v_bad bad node "$S/validate.js"; run v_good good node "$S/validate.js"; run v_partial partial node "$S/validate.js"
code v_bad "反例退出码 1" 1
has v_bad "E1 未知转场" "未知转场 spin"
has v_bad "E2 trans 对象多键" "trans 对象只认 kind ms，多了 speed"
has v_bad "E3 节点 amb 未知" "c1_open: 未知环境音 amb thunder"
has v_bad "E4 bgm 对象未知曲名" "c1_q2: 未知 bgm jazz"
has v_bad "E5 bgm.fade 不是数" "bgm.fade 应是秒数"
has v_bad "E6 bgmVol 超范围" "bgmVol 应是 0–1 的数"
has v_bad "E7 timeout 没有 timer" "写了 timeout 但没有 timer"
has v_bad "E8 timeout 多键" "timeout 只认 next add set，多了 clue"
has v_bad "E9 timeout.next 不存在" "c1_q2.timeout 指向不存在的节点 c1_nowhere"
has v_bad "E10 台词未知键" "lines[0]: 未知选项 shake"
has v_bad "E11 台词 fx 未知" "未知 fx spin"
has v_bad "E12 enter 取值" 'enter 只能是 "left" / "right"'
has v_bad "E13 exit 没带 stage" "exit 要和 stage 写在一起"
has v_bad "E14 台词 amb 未知" "lines[4]: 未知环境音 amb thunder"
has v_bad "E15 台词 bgm 未知" "lines[5]: 未知 bgm jazz"
has v_bad "E16 台词 need 未登记数值" "条件 zz>=3 用了未登记的数值 zz"
has v_bad "E17 未知标记" "未知标记 {blink}"
has v_bad "E18 标记没关" "{slow} 没有关上"
has v_bad "E19 没开就关" "{/big} 前面没有 {big}"
has v_bad "E20 标记交叉" "标记交叉"
has v_bad "E21 {w=} 参数" "{w=abc} 的停顿秒数应是正数"
has v_bad "E22 落单花括号" "有落单的花括号"
has v_bad "E23 f_ 拼错（读了没写）" "读了 f_pikcA，本章没有任何地方 set 它"
has v_bad "E24 f_ 跨章读" "读了 f_pickA，本章没有任何地方 set 它（它在 ch1 设"
has v_bad "E25 f_ 先读后设" "读 f_late，但本章设它的地方都走不到这里"
has v_bad "E26 g_ 只在之后的章设" "读了 g_fromCh2，它只在之后的 ch2 设"
has v_bad "E27 g_ 全剧没人设" "读了 g_ghost，没有任何地方 set 它"
has v_bad "E28 timer 写在没选项的节点" "timer 只能写在有 choices 的节点"
has v_bad "W1 限时没写 timeout" "c1_q: 限时选择没写 timeout"
has v_bad "W2 timer 不在 5–10" "timer 3 秒，建议 5–10 秒"
has v_bad "W3 f_ 写了没读" "设了 f_unused，本章没有条件读它"
has v_bad "W4 g_ 写了没读" "设了 g_never，所有章节没有条件读它"
has v_bad "W5 开头到第一个选择点超 40（默认值）" "第一章开头到第一个选择点 46 句，超过 40"
has v_bad "W6 好感判定后直接 retry" "c1_judge.branch[1] 按数值判定后直接 end: retry"
has v_bad "W7 换曲太频" "本章 13 句换了 3 次 BGM"
has v_bad "W8 整章没有 bgm none" '本章没有 bgm: "none"'
has v_bad "W9 去掉标记后才量字数" "超过 34 字：这一句去掉标记"
has v_bad "E29 day 不是正整数" "c2_e: day 应为正整数"
has v_bad "W11 换天后天数倒退" "时间倒退：c2_b → c2_c（第 2 天 10:00 早于前一个节点）"
hasnt v_good "换天后时间从早上重新算不误报" "时间倒退"
has v_bad "E30 仪表数值没登记" "R.METERS[0].var nope 不在 R.VARS 里"
has v_bad "E31 仪表不认识的键" "R.METERS[1] 不认识的键 color"
has v_bad "W13 副标题在数天" "标题、副标题、章名在数天：三天后，一切都会结束。"
hasnt v_good "正例标题不数天" "在数天"
has v_bad "W12 选项汇合处按好感值分台词" "c1_q2.lines[0] 按数值分台词，可它是 c1_q 的 3 个选项的汇合处"
hasnt v_good "正例没有按数值分的汇合台词" "按数值分台词"
has v_partial "W10 有章节没写时 g_ 读了没写只提醒" "读了 g_maybe，已写的章节里没有地方 set 它（还有章节没写"
has v_partial "缺章 0 错误" "0 个错误"
has v_good "正例 0 错误 0 提醒" "0 个错误，0 个提醒"

echo "solve"
run s_end good node "$S/solve.js" --endings; run s_odds good node "$S/solve.js" --odds c2_judge; run s_merge good node "$S/solve.js" --merge
run s_walk good node "$S/solve.js" --walk 500
has s_walk "随机走能把结局走到并给出路径" "随机走了 500 局"
hasnt s_walk "随机走不先跑满整张图" "搜索被截断"
has s_end "超时当一条路：只有超时能到的 E3 走得到" "✓ E3《沉默结局》"
has s_end "路径里记「（超时）」" "（超时） → 【ch2】"
has s_odds "--odds 只算走得到判定点的入线状态" "2 种走不到判定点，不算"
has s_odds "--odds 最高档概率" "入线 a=3 b=0（最高）：全选最优 → [0] ✓；随机 → [0] 33.3% · [1] 66.7%"
has s_odds "--odds 最低档进不了 Good 报 ✗" "✗ 入线最低全选最优也进不了 [0]"
has s_merge "--merge 列出汇合点" "c1_roof（ch1）2 条来路"
has s_merge "--merge flag 差异" "f_pickA✗"
has s_merge "--merge 在场的人" "在场 a,b"
has s_merge "--merge 超时来路" "← c1_silent →"

echo "playtest"
run p_good good node "$S/playtest.js" 80; run p_old old node "$S/playtest.js" 30; run p_bad badengine node "$S/playtest.js" 30
code p_good "新引擎退出码 0" 0
has p_good "新引擎：超时走 timeout" "走到 timeout.next"
hasnt p_good "新引擎：没有超时走错" "✗ 超时没走"
has p_good "新引擎：章节重玩断言通过" "✓ 章节重玩"
has p_good "新引擎：存档失败断言通过" "✓ 存档失败"
has p_good "新引擎：只有超时能到的节点也覆盖到" "节点覆盖 13/13"
has p_good "新引擎：每个结局按 solve 的选法实跑都到了" "✓ 结局直达"
code p_old "旧引擎不误报（退出码 0）" 0
has p_old "旧引擎：timeout 跳过" "引擎不认 timeout"
has p_old "旧引擎：章节重玩跳过" "· 章节重玩：引擎没有章节快照"
has p_old "旧引擎：存档失败跳过" "· 存档失败：引擎里没有"
code p_bad "坏引擎退出码 1" 1
has p_bad "坏引擎：超时没走 timeout" "✗ 超时没走 timeout.next"
has p_bad "坏引擎：好感加两遍" "✗ 章节重玩"
has p_bad "坏引擎：存档失败不说" "✗ 存档失败"

echo "fingerprint"
run f_same good node "$S/fingerprint.js" "$T/good" "$T/good"; run f_bad bad node "$S/fingerprint.js" "$T/bad" "$T/fp_other"
has f_same "同一个游戏比自己：结构撞了" "! 结构和《工具测试正例》一样"
has f_same "同一个游戏比自己：曲目重合" "! 曲目表和《工具测试正例》重合 100%：t1 t2 t3 t4 t5 t6"
has f_bad "副标题在数天" "! 标题或章名在数天：三天后，一切都会结束。"
hasnt f_bad "结构不同不误报" "! 结构和"
echo "audio_smoke"
run a_good good node "$S/audio_smoke.js"; run a_bad badengine node "$S/audio_smoke.js"; run a_old old node "$S/audio_smoke.js"
has a_good "新 music.js：7 种环境音 0 报错" "环境音 7 种 · 0 个报错"
code a_bad "坏 music.js 退出码 1" 1
has a_bad "registry 有、music.js 没有的环境音" "registry 登记了环境音 waves，music.js 里没有"
has a_bad "环境音一放就抛错" "✗ amb night"
has a_old "新 registry 配旧 music.js" "registry 登记了 AMB，music.js 却没有 Music.amb()"

echo "dump_story / extract_lines"
run d_good good node "$S/dump_story.js"; run x_good good node "$S/extract_lines.js"
for s in "转场 wipe-r 600ms" "配乐 t1，淡入 2 秒" "环境音 cicada" "配乐停（淡出）" "仅当 f_pickA" "没有 f_pickA 才说" "效果 shake2" "从右边进" "往右边出" "音乐压到 0.5" "限时 8 秒，超时 → c1_silent（设 g_silent，好感 a-1）"; do has d_good "dump：$s" "$s"; done
hasnt x_good "配音文本去掉了标记" "{slow"
has x_good "配音文本是纯文字" "\"text\":\"早……上好。\""

if [ "$1" = "--browser" ]; then
  echo "browser_play --audit"
  run b_old old $PY "$S/browser_play.py" --out "$OUT/shots_old" --runs 1 --width 400 --every 0
  run b_good good $PY "$S/browser_play.py" --out "$OUT/shots_good" --runs 1 --width 400 --every 0
  has b_old "宽 400 默认开审计" "触控尺寸（宽 400）"
  has b_old "旧引擎手机 HUD 小于 24 报错" "  ✗ #b"
  code b_old "有小于 24 的按钮退出码 1" 1
  has b_good "新引擎也量了" "触控尺寸（宽 400）"
  grep -F "触控尺寸" -A2 "$OUT/b_good.txt"
fi
echo
echo "通过 $pass 条，失败 $fail 条（输出在 $OUT）"
[ "$fail" = 0 ]
