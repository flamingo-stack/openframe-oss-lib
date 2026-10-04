#!/usr/bin/env bash
# Publishes the packed package (PACKAGE_TARBALL, from pack-package.sh) to
# pkg.pr.new: THE registry of this package. Releases, main-push snapshots and
# pull request builds all live there and nowhere else.
#
# Why. Since 2026-07 npm scans every upload before it serves it; for this package
# that is minutes at best and two hours at worst, with no way to opt out. A
# pkg.pr.new build is installable the moment this step ends, needs no token, and
# is addressed by the commit it was built from:
#
#   https://pkg.pr.new/<owner>/<repo>/<package>@<commit sha>
#
# A RELEASE is also served under its version, the address a consumer pins:
#
#   https://pkg.pr.new/<owner>/<repo>/<package>@<x.y.z>
#
# (pkg.pr.new names a build after the git ref of the run that published it; the
# release workflow runs once more on the version tag for that.) Nothing is
# published to npmjs: the versions already there stay, no new one is added.
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
# (https://github.com/apps/pkg-pr-new); without it the upload is refused and this
# step fails.
set -uo pipefail

TARBALL="${PACKAGE_TARBALL:?run pack-package.sh first}"
PKG=$(jq -r '.name' package.json)
VERSION=$(jq -r '.version' package.json)
REPORT="$PWD/preview-publish.json"
rm -f "$REPORT"

npm exec --no -- pkg-pr-new publish --no-compact --no-template --comment=off --json "$REPORT" "$TARBALL" 2>&1 | tee preview-publish.log
STATUS=${PIPESTATUS[0]}

if [ "$STATUS" -ne 0 ]; then
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

# On a release's version tag (RELEASE_REF): pkg.pr.new also serves this build
# under the ref of the run, which is the version. That is the address a consumer
# pins, so it is checked and printed too.
if [ -n "${RELEASE_REF:-}" ]; then
  NAMED="https://pkg.pr.new/${GITHUB_REPOSITORY}/${PKG}@${RELEASE_REF}"
  code=$(curl -s -o /dev/null -w '%{http_code}' -L "$NAMED" || echo 000)
  {
    echo
    echo "### Release $RELEASE_REF"
    echo
    echo '```json'
    echo "\"$PKG\": \"$NAMED\""
    echo '```'
  } | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
  if [ "$code" != "200" ]; then
    echo "::error::pkg.pr.new does not serve $NAMED (HTTP $code)"
    exit 1
  fi
fi
