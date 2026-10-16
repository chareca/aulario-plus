#!/usr/bin/env bash
# Make dist/chromium and dist/firefox from extension/common and the applicable manifest.
# Then make a ZIP file for each browser.
set -euo pipefail
cd "$(dirname "$0")"

version_of() {
  python3 -I -c "import json, sys; print(json.load(open(sys.argv[1]))['version'])" "$1"
}
VERSION=$(version_of extension/manifest.chromium.json)
FIREFOX_VERSION=$(version_of extension/manifest.firefox.json)
if [ "$VERSION" != "$FIREFOX_VERSION" ]; then
  echo "ERROR: The manifests have different versions: chromium $VERSION, firefox $FIREFOX_VERSION." >&2
  exit 1
fi

python3 -I scripts/make_icons.py extension/common/icons

rm -rf dist
for target in chromium firefox; do
  mkdir -p "dist/$target"
  cp -R extension/common/. "dist/$target/"
  cp "extension/manifest.$target.json" "dist/$target/manifest.json"
  (cd "dist/$target" && zip -qr "../aulario-plus-$target-v$VERSION.zip" .)
done

echo "Version $VERSION is ready:"
echo "  dist/chromium/  (Chrome, Edge, Brave, Opera, Vivaldi, Arc, Helium)"
echo "  dist/firefox/"
echo "  dist/aulario-plus-chromium-v$VERSION.zip"
echo "  dist/aulario-plus-firefox-v$VERSION.zip"
