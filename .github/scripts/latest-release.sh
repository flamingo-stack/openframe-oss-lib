#!/usr/bin/env bash
# Prints the latest RELEASED version of the package in the current directory.
#
# Releases live on pkg.pr.new, which has no version list, so the release history
# is this repository's own tags: `<package dir>-v<x.y.z>`, pushed by the release
# workflow. Before the first such tag exists, the last version published to
# npmjs (where releases went until 2026-10) is the starting point.
set -euo pipefail

PREFIX="$(basename "$PWD")-v"
LATEST=$(git ls-remote --tags origin "refs/tags/${PREFIX}*" 2>/dev/null \
  | sed "s#.*refs/tags/${PREFIX}##" | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1 || true)
if [ -z "$LATEST" ]; then
  LATEST=$(npm view "$(jq -r '.name' package.json)" dist-tags.latest 2>/dev/null || true)
fi
echo "${LATEST:-0.0.0}"
