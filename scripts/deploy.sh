#!/usr/bin/env bash
# Deploy the icon set + wallpaper boot shim to the quiz site.
#
# The quiz site has no build source on the server, so the two entry bundles are patched
# in place (see patch-icons.py) and the patched main bundle is busted with a ?v= query
# because /assets/* is served with a one-year immutable cache.
set -euo pipefail

HOST="${HOST:-hk}"
WEB=/srv/quiz-site/current/dist/web
TS=$(date +%Y%m%d-%H%M%S)
BK="/root/site-backup/quiz-$TS"
ASSET_MAIN=index-D2YsLB2t.js
ASSET_CHUNK=index-CBfRG6oL.js
VER="${VER:-20261030}"
HERE=$(cd "$(dirname "$0")" && pwd)
WORK=$(mktemp -d)

echo "== backup -> $BK"
ssh "$HOST" "mkdir -p $BK && cp -a $WEB/index.html $WEB/theme-init.js $WEB/assets/$ASSET_MAIN $WEB/assets/$ASSET_CHUNK $BK/ && ls -l $BK"

echo "== fetch originals"
scp "$HOST:$WEB/assets/$ASSET_MAIN" "$WORK/main.js"
scp "$HOST:$WEB/assets/$ASSET_CHUNK" "$WORK/chunk.js"
scp "$HOST:$WEB/index.html" "$WORK/index.html"

echo "== patch bundles"
python3 "$HERE/patch-icons.py" "$WORK/main.js" "$WORK/main.patched.js"
python3 "$HERE/patch-icons.py" "$WORK/chunk.js" "$WORK/chunk.patched.js"
python3 "$HERE/patch-copy.py" "$WORK/main.patched.js" "$WORK/main.copy.js"
python3 "$HERE/patch-copy.py" "$WORK/chunk.patched.js" "$WORK/chunk.copy.js"

echo "== bust main bundle cache in index.html"
python3 - "$WORK/index.html" "$ASSET_MAIN" "$VER" <<'PY'
import re
import sys
path, asset, ver = sys.argv[1], sys.argv[2], sys.argv[3]
html = open(path, encoding="utf-8").read()
pattern = re.compile(r'src="/assets/' + re.escape(asset) + r'(?:\?v=[^"]*)?"')
if not pattern.search(html):
    raise SystemExit(f"index.html: script tag for {asset} not found")
html = pattern.sub(f'src="/assets/{asset}?v={ver}"', html)
open(path, "w", encoding="utf-8").write(html)
print("index.html updated")
PY

echo "== upload"
scp "$WORK/main.copy.js" "$HOST:$WEB/assets/$ASSET_MAIN"
scp "$WORK/chunk.copy.js" "$HOST:$WEB/assets/$ASSET_CHUNK"
scp "$HERE/theme-init.js" "$HOST:$WEB/theme-init.js"
scp "$WORK/index.html" "$HOST:$WEB/index.html"
ssh "$HOST" "chown quiz-site:quiz-site $WEB/index.html $WEB/theme-init.js $WEB/assets/$ASSET_MAIN $WEB/assets/$ASSET_CHUNK && chmod 644 $WEB/index.html $WEB/theme-init.js $WEB/assets/$ASSET_MAIN $WEB/assets/$ASSET_CHUNK"

echo "== verify"
ssh "$HOST" "curl -s -o /dev/null -w 'index:%{http_code}\n' -H 'Host: quiz.stillfloating.top' http://127.0.0.1:3107/; curl -s -H 'Host: quiz.stillfloating.top' http://127.0.0.1:3107/ | grep -o 'index-D2YsLB2t.js?v=[0-9]*'; curl -s -H 'Host: quiz.stillfloating.top' http://127.0.0.1:3107/assets/$ASSET_MAIN | grep -c 'QaBubble'"

rm -rf "$WORK"
echo "done"
