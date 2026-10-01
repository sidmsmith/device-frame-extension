#!/usr/bin/env bash
# Publish the current commit as a GitHub release with the extension zip.
# Usage: ./release.sh "Release notes"
set -euo pipefail
cd "$(dirname "$0")"

V=$(node -p "require('./manifest.json').version")
if [ -n "$(git status --porcelain)" ]; then
  echo "Commit your changes first." >&2
  exit 1
fi

mkdir -p dist
git archive --format=zip -o "dist/device_frame_extension-v$V.zip" HEAD
# Same file name on every release, so .../releases/latest/download/device_frame_extension.zip
# always points at the newest version.
cp "dist/device_frame_extension-v$V.zip" dist/device_frame_extension.zip

git push origin HEAD
gh release create "v$V" dist/device_frame_extension.zip --title "v$V" --notes "${1:-Device Frame v$V}" --latest
