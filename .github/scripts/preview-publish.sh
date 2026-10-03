#!/usr/bin/env bash
# Publishes the package in the current directory to pkg.pr.new: the registry OUR
# OWN apps install this library from.
#
# Why. Since 2026-07 npm scans every upload before it serves it; for this package
# that is minutes at best and over an hour at worst, with no way to opt out. A
# pkg.pr.new build is installable the moment this step ends, needs no token, and
# is addressed by the commit it was built from:
#
#   https://pkg.pr.new/<owner>/<repo>/<package>@<commit sha>
#
# A consumer pins that URL in its package.json. npmjs still gets every version
# (npm-publish.sh) for everyone else. pkg.pr.new removes a build after six
# months, or after one month when nobody downloaded it in the last month: a pin
# is expected to move forward, never to be restored from an old commit.
#
# Needs the pkg.pr.new GitHub App on the repository
# (https://github.com/apps/pkg-pr-new). Until it is installed this step warns
# and passes, so it cannot block a pull request or a release.
set -uo pipefail

PKG=$(jq -r '.name' package.json)
VERSION=$(jq -r '.version' package.json)
# A pull request's build is the PR's head commit, not the merge commit Actions checks out.
SHA="${PREVIEW_SHA:-${GITHUB_SHA:-}}"
URL="https://pkg.pr.new/${GITHUB_REPOSITORY}/${PKG}@${SHA}"
# Pinned: this runs in the release pipeline.
CLI="pkg-pr-new@0.0.88"

npx --yes "$CLI" publish --no-template --comment=off 2>&1 | tee preview-publish.log
STATUS=${PIPESTATUS[0]}

if [ "$STATUS" -ne 0 ]; then
  if grep -qiE "not installed|install the (github )?app" preview-publish.log; then
    echo "::warning::pkg.pr.new is not installed on ${GITHUB_REPOSITORY} (https://github.com/apps/pkg-pr-new): no preview build was published."
    exit 0
  fi
  echo "::error::pkg.pr.new refused the build of $PKG@$VERSION"
  exit "$STATUS"
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
