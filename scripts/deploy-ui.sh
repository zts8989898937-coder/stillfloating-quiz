#!/usr/bin/env bash
# Upload the visual polish layer (ui-polish.css / ui-polish.js) and wire it into index.html.
set -euo pipefail

HOST="${HOST:-hk}"
WEB=/srv/quiz-site/current/dist/web
TS=$(date +%Y%m%d-%H%M%S)
BK="/root/site-backup/quiz-ui-$TS"
VER="${VER:-$(date +%H%M%S)}"
HERE=$(cd "$(dirname "$0")" && pwd)
WORK=$(mktemp -d)

echo "== backup -> $BK"
ssh "$HOST" "mkdir -p $BK && cp -a $WEB/index.html $WEB/assets/ui-polish.css $WEB/assets/ui-polish.js $BK/ 2>/dev/null; ls -l $BK"

echo "== upload assets"
scp "$HERE/ui-polish.css" "$HOST:$WEB/assets/ui-polish.css"
scp "$HERE/ui-polish.js" "$HOST:$WEB/assets/ui-polish.js"

echo "== wire tags into index.html"
scp "$HOST:$WEB/index.html" "$WORK/index.html"
python3 - "$WORK/index.html" "$VER" <<'PY'
import re
import sys

path, ver = sys.argv[1], sys.argv[2]
html = open(path, encoding="utf-8").read()

# drop previous versions of our tags (idempotent re-deploy)
html = re.sub(r'\n\s*<link rel="stylesheet"[^>]*ui-polish\.css[^>]*>', "", html)
html = re.sub(r'\n\s*<script[^>]*ui-polish\.js[^>]*></script>', "", html)

css = f'\n    <link rel="stylesheet" crossorigin href="/assets/ui-polish.css?v={ver}">'
js = f'\n    <script src="/assets/ui-polish.js?v={ver}" defer></script>'

anchor = re.search(r'\n\s*<link rel="stylesheet"[^>]*index-[A-Za-z0-9_-]+\.css"[^>]*>', html)
if not anchor:
    raise SystemExit("index.html: app stylesheet link not found")
html = html.replace(anchor.group(0), anchor.group(0) + css)

# defer script right after the stylesheet block
html = html.replace("</head>", js + "\n  </head>")
open(path, "w", encoding="utf-8").write(html)
print("index.html wired")
PY

scp "$WORK/index.html" "$HOST:$WEB/index.html"
ssh "$HOST" "chown quiz-site:quiz-site $WEB/index.html $WEB/assets/ui-polish.css $WEB/assets/ui-polish.js && chmod 644 $WEB/index.html $WEB/assets/ui-polish.css $WEB/assets/ui-polish.js"

echo "== verify"
ssh "$HOST" "curl -s -H 'Host: quiz.stillfloating.top' http://127.0.0.1:3107/ | grep -o 'ui-polish[^\" ]*'; curl -s -o /dev/null -w 'css:%{http_code}\n' -H 'Host: quiz.stillfloating.top' http://127.0.0.1:3107/assets/ui-polish.css; curl -s -o /dev/null -w 'js:%{http_code}\n' -H 'Host: quiz.stillfloating.top' http://127.0.0.1:3107/assets/ui-polish.js"

rm -rf "$WORK"
echo "done"
