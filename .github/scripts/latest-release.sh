#!/usr/bin/env bash
# Prints the latest RELEASED version of the package in the current directory.
#
# Releases live on pkg.pr.new, which has no version list, so the release history
# is this repository's own tags: the release workflow tags every release
# `<x.y.z>` (the tag whose run gives the release its version-named address).
# Before the first such tag, the last version published to npmjs (where releases
# also went until 2026-10) is the starting point.
set -euo pipefail

LATEST=$(git ls-remote --tags origin 2>/dev/null \
  | sed -n 's#.*refs/tags/\([0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\)$#\1#p' | sort -V | tail -1 || true)
if [ -z "$LATEST" ]; then
  LATEST=$(npm view "$(jq -r '.name' package.json)" dist-tags.latest 2>/dev/null || true)
fi
echo "${LATEST:-0.0.0}"
