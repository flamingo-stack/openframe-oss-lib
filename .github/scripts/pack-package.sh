#!/usr/bin/env bash
# Packs the BUILT package in the current directory ONCE, and records the tarball
# as PACKAGE_TARBALL. Every registry is then given that same file
# (preview-publish.sh, npm-publish.sh), so what our apps install and what npmjs
# mirrors are the same bytes.
#
# `--ignore-scripts`: the Build step already ran. Without it `prepack` builds the
# whole package again for every registry it is packed for.
set -euo pipefail

FILE=$(npm pack --ignore-scripts --json | jq -r '.[0].filename')
[ -s "$FILE" ] || { echo "::error::npm pack produced no tarball"; exit 1; }
TARBALL="$PWD/$FILE"
echo "Packed $(jq -r '.name' package.json)@$(jq -r '.version' package.json): $TARBALL ($(wc -c < "$TARBALL" | tr -d ' ') bytes)"
if [ -n "${GITHUB_ENV:-}" ]; then echo "PACKAGE_TARBALL=$TARBALL" >> "$GITHUB_ENV"; fi
