#!/usr/bin/env bash
# Packs the BUILT package in the current directory and records the tarball as
# PACKAGE_TARBALL, the file preview-publish.sh uploads.
#
# `--ignore-scripts`: the Build step already ran. Without it `prepack` builds the
# whole package a second time.
set -euo pipefail

FILE=$(npm pack --ignore-scripts --json | jq -r '.[0].filename')
[ -s "$FILE" ] || { echo "::error::npm pack produced no tarball"; exit 1; }
TARBALL="$PWD/$FILE"
echo "Packed $(jq -r '.name' package.json)@$(jq -r '.version' package.json): $TARBALL ($(wc -c < "$TARBALL" | tr -d ' ') bytes)"
if [ -n "${GITHUB_ENV:-}" ]; then echo "PACKAGE_TARBALL=$TARBALL" >> "$GITHUB_ENV"; fi
