#!/usr/bin/env python3
"""Replace the coach-style copy in the quiz bundles with lyric lines from the blog.

Sources: GET https://stillfloating.top/wp-json/stillfloating/v1/lyrics (argon_footer_html 里的 GROUPS).

Two pools are replaced:
  Pi  —— 首页时钟下方的轮换语（日间 6 条 / 夜间 6 条）
  Ei  —— 每日运势的“签语”（9 条，宜忌保留不动，它们是运势的玩法本身）

Idempotent: already-replaced strings are skipped, so the script can run again.

Usage: patch-copy.py <input.js> <output.js>
"""
import sys

DAY_LINES = [
    'Getting strong today — Spiritualized',
    'A giant step each day — Spiritualized',
    'Today is gonna be the day — Oasis',
    'Here comes the sun — The Beatles',
    '总会有光如约出现 — 福禄寿',
    "We see things they'll never see — Oasis",
]

NIGHT_LINES = [
    'And float in space and drift in time — Spiritualized',
    'The pages keep turning — Stars',
    "We don't want to sleep tonight — Stars",
    'Everything in its right place — Radiohead',
    '等到春暖艳阳天，你我就相见 — 福禄寿',
    "Keep it simple, you'll be fine — EAR",
]

OLD_DAY = [
    '先做一道题，进入状态再说。',
    '昨天没想通的，今天再试试。',
    '别急着看答案，再想一步。',
    '能讲明白一道题，就算有收获。',
    '卡住很正常，拿笔画一画。',
    '题不在多，做过的要弄明白。',
]

OLD_NIGHT = [
    '一道题磨了很久，也不算白学。',
    '还没做出来也没事，明天接着想。',
    '做完这一题，就去歇会儿。',
    '今天弄懂的，明天还能用上。',
    '困了就睡，题目不会跑。',
    '留个记号，明天从这里继续。',
]

FORTUNE_SIGNATURES = [
    ('适合把搁置的一小步重新拾起。', 'Ladies and gentlemen we are floating in space — Spiritualized'),
    ('节奏稳一点，反而更容易走远。', 'All you need is love — The Beatles'),
    ('今天的灵感藏在熟悉的内容里。', 'Here, there and everywhere — The Beatles'),
    ('平平常常的一天，也适合认真开始。', 'Letting the days go by — Talking Heads'),
    ('先把眼前这一页看完，答案会慢慢清楚。', 'Things unravel right on time — EAR'),
    ('不急着证明自己，先把过程走完。', "We're not finished yet — The Coral Sea"),
    ('今天适合开始，也适合轻轻收尾。', 'Shine on until tomorrow, let it be — The Beatles'),
    ('慢一点，能看见更多细节。', 'Take a sad song and make it better — The Beatles'),
    ('今天的好运，是一点点积累出来的。', 'The movement you need is on your shoulder — The Beatles'),
]


def tick(s):
    return '`' + s + '`'


def replace_pool(code, old_lines, new_lines):
    old_block = ','.join(tick(x) for x in old_lines)
    new_block = ','.join(tick(x) for x in new_lines)
    if old_block in code:
        return code.replace(old_block, new_block), 1
    if new_block in code:
        return code, 1
    return code, 0


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    src, dst = sys.argv[1], sys.argv[2]
    with open(src, encoding="utf-8") as fh:
        code = fh.read()

    code, day_ok = replace_pool(code, OLD_DAY, DAY_LINES)
    code, night_ok = replace_pool(code, OLD_NIGHT, NIGHT_LINES)
    if not (day_ok and night_ok):
        print("FAIL: greeting pool not found (neither old nor new form)")
        return 1

    applied = 0
    for old, new in FORTUNE_SIGNATURES:
        old_token = 'signature:' + tick(old)
        new_token = 'signature:' + tick(new)
        if old_token in code:
            code = code.replace(old_token, new_token)
            applied += 1
        elif new_token in code:
            applied += 1
    if applied != len(FORTUNE_SIGNATURES):
        print(f"FAIL: fortune signatures matched {applied}/{len(FORTUNE_SIGNATURES)}")
        return 1

    with open(dst, "w", encoding="utf-8") as fh:
        fh.write(code)
    print(f"patched copy {src} -> {dst}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
