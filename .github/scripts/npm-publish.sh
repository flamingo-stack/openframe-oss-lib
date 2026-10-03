#!/usr/bin/env bash
# THE npmjs publish of this repository's packages: every workflow that publishes
# (a release, a main-push snapshot, a pull request's prerelease) calls this from
# the package's directory.
#
#   npm-publish.sh <dist-tag> [extra `npm publish` arguments]
#
# npmjs is the PUBLIC MIRROR, not what our own apps install from (that is
# pkg.pr.new, preview-publish.sh). Since 2026-07 npm scans every upload before it
# serves it: the upload is answered 202 ("being processed") and the version
# appears minutes to more than an hour later. So this step does NOT wait for npm:
# a run that waited 25 minutes (2026-10-03) was still not served, and nothing of
# ours depends on it.
#
# What it does do: a release moves to the next patch number when npm already
# holds the computed one. An upload that is still being scanned keeps its number
# while `latest` still names the previous release, so the next run computes the
# same number and npm refuses it ("Cannot publish over previously staged
# version", or "previously published versions" once it lands).
set -euo pipefail

TAG="${1:?usage: npm-publish.sh <dist-tag> [npm publish args]}"
shift
PKG=$(jq -r '.name' package.json)

for attempt in 1 2 3 4 5; do
  if npm publish --tag "$TAG" "$@" 2>&1 | tee publish.log; then
    VERSION=$(jq -r '.version' package.json)
    # What was uploaded, for the summary and any later step (it differs from the computed number after a skip).
    if [ -n "${GITHUB_ENV:-}" ]; then echo "NEW_VERSION=$VERSION" >> "$GITHUB_ENV"; fi
    echo "Uploaded $PKG@$VERSION to npmjs ($TAG). npm serves it after its scan: minutes, sometimes over an hour." | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
    exit 0
  fi
  # Only a release has a number that can be taken; a snapshot's and a pull
  # request's carry a timestamp or a run number.
  if [ "$TAG" != "latest" ] || ! grep -qE "previously (staged|published) version" publish.log; then
    exit 1
  fi
  TAKEN=$(jq -r '.version' package.json)
  npm version patch --no-git-tag-version > /dev/null
  echo "::warning::npm already holds $TAKEN (staged or published); publishing $(jq -r '.version' package.json) instead"
done
echo "No free version number after 5 attempts"
exit 1
