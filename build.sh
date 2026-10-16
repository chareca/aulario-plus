#!/usr/bin/env bash
# Make dist/chromium and dist/firefox from extension/common and the applicable manifest.
# Then make a ZIP file for each browser.
set -euo pipefail
cd "$(dirname "$0")"

VERSION=$(python3 -I -c "import json, sys; print(json.load(open(sys.argv[1]))['version'])" extension/manifest.chromium.json)

python3 -I scripts/make_icons.py extension/common/icons

rm -rf dist
for target in chromium firefox; do
  mkdir -p "dist/$target"
  cp -R extension/common/. "dist/$target/"
  cp "extension/manifest.$target.json" "dist/$target/manifest.json"
  (cd "dist/$target" && zip -qr "../miaulario-keepalive-$target-v$VERSION.zip" .)
done

echo "Version $VERSION is ready:"
echo "  dist/chromium/  (Chrome, Edge, Brave, Opera, Vivaldi, Arc, Helium)"
echo "  dist/firefox/"
echo "  dist/miaulario-keepalive-chromium-v$VERSION.zip"
echo "  dist/miaulario-keepalive-firefox-v$VERSION.zip"
