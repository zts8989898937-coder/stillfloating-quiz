#!/usr/bin/env python3
"""Patch the built quiz-site bundles so every sidebar function gets a distinct icon.

The quiz site ships only build artifacts on the server (no website/web source), so the
icon set is patched directly in the bundles that define it. Two copies of the sidebar
exist: the main entry bundle and a lazy route chunk; both are handled here.

Icon set changes:
  错题分析      doc+chart      -> magnifier over bars
  AI 学习总结   doc+lines      -> sparkle
  使用说明      doc+question   -> compass
  学习问答      MessageSquareText (shared) -> speech bubble with "?"
  我的反馈      MessageSquareText (shared) -> paper plane
  网站反馈      MessageSquareText (shared) -> warning triangle

Every group must match at least one anchor, otherwise the script fails loudly instead of
silently producing a half-patched bundle.

Usage: patch-icons.py <input.js> <output.js>
"""
import sys

# Icon definition strings shared by both bundles.
DEFINITIONS = [
    ("Tt=I(`ReviewFocus`,`M5 3h14v18H5ZM8 7h5m-5 4h8m-8 4h3m3 1 2 2 4-5`)",
     "Tt=I(`ReviewFocus`,`M10.5 3.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM15.5 15 21 20.5M7.5 12V9m3 3V7m3 5v-2`)"),
    ("wt=I(`SummaryNotes`,`M5 4h14v17H5ZM8 8h8m-8 4h6m-6 4h3m3 0h2`)",
     "wt=I(`SummaryNotes`,`M12 3c.5 4.2 2.3 6 6.5 6.5-4.2.5-6 2.3-6.5 6.5-.5-4.2-2.3-6-6.5-6.5C9.7 9 11.5 7.2 12 3ZM18.5 15.5c.2 1.6.9 2.3 2.5 2.5-1.6.2-2.3.9-2.5 2.5-.2-1.6-.9-2.3-2.5-2.5 1.6-.2 2.3-.9 2.5-2.5Z`)"),
    ("Pt=I(`CircleHelp`,`M5 4h14v17H5ZM9 9a3 3 0 1 1 4 3c-1 .4-1 1-1 2m0 3h.01`)",
     "Pt=I(`CircleHelp`,`M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM15.2 8.8l-2 4.4-4.4 2 2-4.4 4.4-2Z`)"),
    # 隐藏陪伴/高松灯：原来的音符图标容易被当成音乐功能，换成“陪伴角色”的表情
    ("Mt=I(`Companion`,`M9 17V6l11-3v12M9 8l11-3M9 17c0 4-6 4-6 1s6-4 6-1Zm11-2c0 4-6 4-6 1s6-4 6-1Z`)",
     "Mt=I(`Companion`,`M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM9 10h.01M15 10h.01M8.5 14a4.5 4.5 0 0 0 7 0`)"),
    # new icons appended to the same declaration chain (vars chosen to avoid collisions)
    (",Ft=I(`MessageSquareText`",
     ",Nq1=I(`QaBubble`,`M4 4h16v13H9l-5 4ZM9.5 8.5a2.5 2.5 0 0 1 5 0c0 1.6-2.5 1.6-2.5 3.5M12 15h.01`)"
     ",Nq2=I(`PaperPlane`,`M3 12 21 4 14 21 10.5 14.5 3 12ZM10.5 14.5 21 4`)"
     ",Nq3=I(`ReportWarn`,`M12 4 21 19H3L12 4ZM12 9v4m0 3h.01`)"
     ",Ft=I(`MessageSquareText`"),
]

# Call sites: a group may match in either bundle variant; at least one must apply.
CALL_SITES = [
    [("\"data-label\":`学习问答`,onClick:()=>{t(!1),gt()},children:[(0,F.jsx)(Ft,{size:18})",
      "\"data-label\":`学习问答`,onClick:()=>{t(!1),gt()},children:[(0,F.jsx)(Nq1,{size:18})")],
    [("\"data-label\":`我的反馈`,onClick:()=>t(!1),children:[(0,F.jsx)(Ft,{size:18,\"aria-hidden\":`true`})",
      "\"data-label\":`我的反馈`,onClick:()=>t(!1),children:[(0,F.jsx)(Nq2,{size:18,\"aria-hidden\":`true`})"),
     ("{to:`/feedback`,label:`我的反馈`,icon:Ft}",
      "{to:`/feedback`,label:`我的反馈`,icon:Nq2}")],
    [("\"data-label\":`网站反馈`,onClick:()=>{t(!1),a(!0)},children:[(0,F.jsx)(Ft,{size:18,\"aria-hidden\":`true`})",
      "\"data-label\":`网站反馈`,onClick:()=>{t(!1),a(!0)},children:[(0,F.jsx)(Nq3,{size:18,\"aria-hidden\":`true`})")],
]


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    src, dst = sys.argv[1], sys.argv[2]
    with open(src, encoding="utf-8") as fh:
        code = fh.read()

    for old, new in DEFINITIONS:
        if code.count(old) == 1:
            code = code.replace(old, new)
        elif code.count(new) == 1:
            continue  # already patched, keep re-runnable
        else:
            print(f"FAIL: definition anchor matched neither old nor new form:\n  {old[:80]}")
            return 1

    for group in CALL_SITES:
        applied = 0
        for old, new in group:
            if code.count(old) == 1:
                code = code.replace(old, new)
                applied += 1
            elif code.count(new) == 1:
                applied += 1  # already patched
        if applied == 0:
            print(f"FAIL: no call-site anchor matched for group:\n  {group[0][0][:90]}")
            return 1

    with open(dst, "w", encoding="utf-8") as fh:
        fh.write(code)
    print(f"patched {src} -> {dst}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
