#!/usr/bin/env bash
# THE npm publish of this repository's packages: every workflow that publishes
# (a release, a main-push snapshot, a pull request's prerelease) calls this, from
# the package's directory, as the step named "Publish …".
#
#   npm-publish.sh <dist-tag> [extra `npm publish` arguments]
#
# Why it exists. npm takes a large package asynchronously: the upload is answered
# 202 ("being processed") and the version appears a few minutes later. When a
# SECOND publish of the same package arrives while one is still being processed,
# npm sets one of them aside and it appears about an hour later (measured
# 2026-10-03: every publish that overlapped another took 55 to 86 minutes, every
# other one 5 to 10). Three workflows publish this package independently, so
# overlaps were routine and a release could sit behind a snapshot for over an hour.
#
# So a publish here does three things:
#  1. TAKES ITS TURN: it waits while another run's "Publish …" step that started
#     earlier is still running (FIFO by step start, read from the Actions API).
#  2. PUBLISHES, and a release moves to the next patch number when npm already
#     holds the computed one (an earlier upload that is staged or published).
#  3. WAITS UNTIL npm SERVES the version, so the step ends (and the next publish
#     starts) only when the registry is done, and a green run means installable.
set -euo pipefail

TAG="${1:?usage: npm-publish.sh <dist-tag> [npm publish args]}"
shift
PKG=$(jq -r '.name' package.json)
REGISTRY="https://registry.npmjs.org"
# The workflows whose "Publish …" steps share this queue.
PUBLISH_WORKFLOWS="${PUBLISH_WORKFLOWS:-release.yml test.yml}"
QUEUE_MAX_SECONDS="${QUEUE_MAX_SECONDS:-2400}"
VISIBLE_MAX_SECONDS="${VISIBLE_MAX_SECONDS:-1500}"
POLL_SECONDS="${POLL_SECONDS:-20}"

api() { gh api "$@" 2>/dev/null; }

# "<started_at> <run id>" of every OTHER run's Publish step that is running now.
others_publishing() {
  local wf run
  for wf in $PUBLISH_WORKFLOWS; do
    for run in $(api "repos/$GITHUB_REPOSITORY/actions/workflows/$wf/runs?per_page=50" \
      -q '.workflow_runs[] | select(.status != "completed") | .id'); do
      [ "$run" = "$GITHUB_RUN_ID" ] && continue
      api "repos/$GITHUB_REPOSITORY/actions/runs/$run/jobs?per_page=100" \
        -q ".jobs[].steps[]? | select((.name | startswith(\"Publish \")) and .status == \"in_progress\") | \"\(.started_at) $run\"" || true
    done
  done
}

my_publish_start() {
  api "repos/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID/jobs?per_page=100" \
    -q '[.jobs[].steps[]? | select((.name | startswith("Publish ")) and .status == "in_progress") | .started_at][0] // empty' || true
}

take_turn() {
  if [ -z "${GH_TOKEN:-}" ] || [ -z "${GITHUB_RUN_ID:-}" ]; then
    echo "No Actions token here: publishing without queueing."
    return
  fi
  # The API shows a step as running a few seconds after it starts.
  sleep 10
  local mine deadline ahead
  mine=$(my_publish_start)
  mine="${mine:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"
  deadline=$((SECONDS + QUEUE_MAX_SECONDS))
  while :; do
    # Ahead of this run: a Publish step that started earlier (the run id breaks a tie).
    ahead=$(others_publishing | awk -v t="$mine" -v me="$GITHUB_RUN_ID" '$1 < t || ($1 == t && $2 < me)' | wc -l | tr -d ' ')
    if [ "$ahead" = "0" ]; then return; fi
    if [ "$SECONDS" -ge "$deadline" ]; then
      echo "::warning::Still $ahead publish(es) ahead after $((QUEUE_MAX_SECONDS / 60)) minutes; publishing anyway."
      return
    fi
    echo "Waiting for $ahead earlier publish(es) of $PKG to finish…"
    sleep "$POLL_SECONDS"
  done
}

publish() {
  local attempt taken
  for attempt in 1 2 3 4 5; do
    if npm publish --tag "$TAG" "$@" 2>&1 | tee publish.log; then return 0; fi
    # Only a release has a number that can be taken; a snapshot's and a pull
    # request's carry a timestamp or a run number.
    if [ "$TAG" != "latest" ] || ! grep -qE "previously (staged|published) version" publish.log; then
      return 1
    fi
    taken=$(jq -r '.version' package.json)
    npm version patch --no-git-tag-version > /dev/null
    echo "::warning::npm already holds $taken (staged or published); publishing $(jq -r '.version' package.json) instead"
  done
  echo "No free version number after 5 attempts"
  return 1
}

wait_until_served() {
  local version="$1" deadline code
  deadline=$((SECONDS + VISIBLE_MAX_SECONDS))
  while :; do
    code=$(curl -s -o /dev/null -w '%{http_code}' "$REGISTRY/${PKG/\//%2f}/$version" || echo 000)
    if [ "$code" = "200" ]; then return 0; fi
    if [ "$SECONDS" -ge "$deadline" ]; then return 1; fi
    echo "npm is still processing $PKG@$version…"
    sleep "$POLL_SECONDS"
  done
}

take_turn
publish "$@"
VERSION=$(jq -r '.version' package.json)
# What was published, for the summary and any later step (it differs from the computed number after a skip).
if [ -n "${GITHUB_ENV:-}" ]; then echo "NEW_VERSION=$VERSION" >> "$GITHUB_ENV"; fi

if wait_until_served "$VERSION"; then
  echo "Published $PKG@$VERSION ($TAG): npm serves it." | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
  exit 0
fi

MESSAGE="$PKG@$VERSION was UPLOADED but npm does not serve it after $((VISIBLE_MAX_SECONDS / 60)) minutes. Do not run the release again (the number is taken and the upload will appear); check https://www.npmjs.com/package/$PKG?activeTab=versions."
echo "$MESSAGE" | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
if [ "$TAG" = "latest" ]; then
  echo "::error::$MESSAGE"
  exit 1
fi
echo "::warning::$MESSAGE"
