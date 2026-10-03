#!/usr/bin/env bash
# Publishes the packed package (PACKAGE_TARBALL, from pack-package.sh) to
# pkg.pr.new: the registry OUR OWN apps install this library from.
#
# Why. Since 2026-07 npm scans every upload before it serves it; for this package
# that is minutes at best and two hours at worst, with no way to opt out. A
# pkg.pr.new build is installable the moment this step ends, needs no token, and
# is addressed by the commit it was built from:
#
#   https://pkg.pr.new/<owner>/<repo>/<package>@<commit sha>
#
# A consumer pins that URL in its package.json. npmjs still gets every real
# release (npm-publish.sh) for everyone else.
#
# How, by pkg.pr.new's own guidance:
#  - the CLI is a pinned devDependency run with `npm exec`, never `npx` (a release
#    pipeline does not download and run an unpinned tool);
#  - it is called once per workflow run;
#  - it is given the prebuilt tarball, which it uploads as it is;
#  - `--no-compact`: the long URL does not depend on npm's metadata for the package;
#  - the URL is read from the CLI's own `--json` report, never assembled here.
#
# To know: a pull request's build is of the PR merged into its base (what Actions
# checks out), labelled with the PR's head commit. pkg.pr.new removes a build
# after six months, or after one month when nobody downloaded it in the last
# month: a pin moves forward, it is never restored from an old commit.
#
# Needs the pkg.pr.new GitHub App on the repository
# (https://github.com/apps/pkg-pr-new). Until it is installed this step warns
# and passes, so it cannot block a pull request or a release.
set -uo pipefail

TARBALL="${PACKAGE_TARBALL:?run pack-package.sh first}"
PKG=$(jq -r '.name' package.json)
VERSION=$(jq -r '.version' package.json)
REPORT="$PWD/preview-publish.json"
rm -f "$REPORT"

npm exec --no -- pkg-pr-new publish --no-compact --no-template --comment=off --json "$REPORT" "$TARBALL" 2>&1 | tee preview-publish.log
STATUS=${PIPESTATUS[0]}

if [ "$STATUS" -ne 0 ]; then
  if grep -qiE "not installed|install the (github )?app" preview-publish.log; then
    echo "::warning::pkg.pr.new is not installed on ${GITHUB_REPOSITORY:-this repository} (https://github.com/apps/pkg-pr-new): no build was published."
    exit 0
  fi
  echo "::error::pkg.pr.new refused the build of $PKG@$VERSION"
  exit "$STATUS"
fi

URL=$(jq -r --arg name "$PKG" '.packages[] | select(.name == $name) | .url' "$REPORT" 2>/dev/null | head -1)
if [ -z "$URL" ] || [ "$URL" = "null" ]; then
  echo "::error::pkg.pr.new reported no URL for $PKG"
  exit 1
fi

code=$(curl -s -o /dev/null -w '%{http_code}' -L "$URL" || echo 000)
{
  echo "### Installable now"
  echo
  echo "\`$PKG\` $VERSION, from pkg.pr.new (HTTP $code):"
  echo
  echo '```json'
  echo "\"$PKG\": \"$URL\""
  echo '```'
} | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
if [ "$code" != "200" ]; then
  echo "::error::pkg.pr.new accepted the build but does not serve $URL (HTTP $code)"
  exit 1
fi
if [ -n "${GITHUB_ENV:-}" ]; then echo "PREVIEW_URL=$URL" >> "$GITHUB_ENV"; fi
