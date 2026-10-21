#!/usr/bin/env bash
# Deploy the extension to ~/.local/share/gnome-shell/extensions and reload
# it without logging out. The impl loader picks the newest impl-<stamp>.js,
# so a fresh filename bypasses GNOME Shell's ES-module cache per deploy.
set -euo pipefail

SRC_DIR="$(cd "$(dirname "$0")" && pwd)/gnome-notch@ther12k"
UUID="gnome-notch@ther12k"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"
EXT="gnome-extensions"

echo "syntax checks..."
node --check "$SRC_DIR/extension.js" && echo "  loader: OK"
node --check "$SRC_DIR/impl.js" && echo "  impl: OK"
python3 -c "import ast; ast.parse(open('$SRC_DIR/ai-collector.py').read())" && echo "  collector: OK"

echo "installing to $DEST ..."
rm -rf "$DEST"
mkdir -p "$DEST"
cp -r "$SRC_DIR/." "$DEST/"
STAMP="$(date +%Y%m%d%H%M%S)"
cp "$DEST/impl.js" "$DEST/impl-$STAMP.js"
rm "$DEST/impl.js"
echo "  build: impl-$STAMP.js"

# The AI-quota notch from aiacctool occupies the same top-center chrome;
# turn it off so the two pills don't stack.
$EXT disable ai-usage-monitor@ther12k 2>/dev/null || true

echo "reloading extension..."
$EXT disable "$UUID" 2>/dev/null || true
sleep 1
$EXT enable "$UUID" 2>/dev/null \
    || echo "  not registered yet: GNOME Shell scans new UUIDs at login."
echo "  -> log out once, then re-run ./deploy.sh to activate $UUID."
sleep 3
$EXT info "$UUID" 2>/dev/null | head -3 || true

echo "--- last journal lines (build tag + errors):"
journalctl -b --no-pager --since "-1 min" 2>/dev/null \
    | grep -iE "\[Notch\]|JS ERROR" | tail -8
echo "done. Hover the top-center pill; click it for the menu."
