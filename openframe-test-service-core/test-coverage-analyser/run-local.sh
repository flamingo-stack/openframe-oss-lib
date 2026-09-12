#!/usr/bin/env bash
# Manual trigger for the API test-coverage gap analysis (see PLAN.md).
#
# Usage:
#   ./run-local.sh                                  # today's date, origin/main everywhere, matrix + Claude report
#   ./run-local.sh --no-llm                         # matrix only (coverage.md / coverage.json), no Claude run
#   ./run-local.sh --test-ref origin/test/my-branch # score a test branch instead of main
#   ./run-local.sh --date 2026-09-12 --no-fetch     # re-run into an existing results folder without fetching
#
# Options: --ref <ref> (product repos and frontend, default origin/main) · --test-ref <ref> ·
#          --frontend-ref <ref> · --recent-days <n> (default 30) · --no-history (skip per-op introduced
#          dates) · --model <id> (default claude-opus-5, or env CLAUDE_MODEL) · --no-fetch · --no-llm
#
# What it does: fetches the five repositories (read-only, never checks anything out), runs
# coverage_matrix.py against the pinned refs, then runs Claude Code headless on prompt.md to turn the
# matrix into a prioritised report. Everything lands in results/<date>/. Nothing is pushed or posted.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---------------------------------------------------------------- locate sibling repos
find_root() {
  local d="$HERE"
  while [ "$d" != "/" ]; do
    if [ -d "$d/openframe-oss-lib/.git" ] && [ -d "$d/openframe-saas-tenant/.git" ]; then
      echo "$d"; return 0
    fi
    d="$(dirname "$d")"
  done
  return 1
}
FLAMINGO_ROOT="${FLAMINGO_ROOT:-$(find_root || true)}"
if [ -z "$FLAMINGO_ROOT" ]; then
  echo "cannot find openframe-oss-lib and openframe-saas-tenant above $HERE; set FLAMINGO_ROOT" >&2
  exit 2
fi
OSS_LIB_REPO="${OSS_LIB_REPO:-$FLAMINGO_ROOT/openframe-oss-lib}"
SAAS_LIB_REPO="${SAAS_LIB_REPO:-$FLAMINGO_ROOT/openframe-saas-lib}"
SAAS_SHARED_REPO="${SAAS_SHARED_REPO:-$FLAMINGO_ROOT/openframe-saas-shared}"
SAAS_TENANT_REPO="${SAAS_TENANT_REPO:-$FLAMINGO_ROOT/openframe-saas-tenant}"
FRONTEND_REPO="${FRONTEND_REPO:-$FLAMINGO_ROOT/openframe-oss-frontend}"

# ---------------------------------------------------------------- arguments
RUN_DATE="$(date -u +%F)"; REF="origin/main"; TEST_REF=""; FRONTEND_REF=""; RECENT_DAYS=30
FETCH=1; LLM=1; HISTORY=1
CLAUDE_MODEL="${CLAUDE_MODEL:-claude-opus-5}"
while [ $# -gt 0 ]; do
  case "$1" in
    --date) RUN_DATE="$2"; shift 2 ;;
    --ref) REF="$2"; shift 2 ;;
    --test-ref) TEST_REF="$2"; shift 2 ;;
    --frontend-ref) FRONTEND_REF="$2"; shift 2 ;;
    --recent-days) RECENT_DAYS="$2"; shift 2 ;;
    --model) CLAUDE_MODEL="$2"; shift 2 ;;
    --no-fetch) FETCH=0; shift ;;
    --no-llm) LLM=0; shift ;;
    --no-history) HISTORY=0; shift ;;
    -h|--help) sed -n '2,17p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
TEST_REF="${TEST_REF:-$REF}"; FRONTEND_REF="${FRONTEND_REF:-$REF}"

RESULTS_DIR="$HERE/results/$RUN_DATE"
mkdir -p "$RESULTS_DIR"
exec > >(tee -a "$RESULTS_DIR/run.log") 2>&1
echo "== test-coverage-analyser run for $RUN_DATE at $(date -u +%FT%TZ) =="

# ---------------------------------------------------------------- fetch (read-only) and pin refs
for repo in "$OSS_LIB_REPO" "$SAAS_LIB_REPO" "$SAAS_SHARED_REPO" "$SAAS_TENANT_REPO" "$FRONTEND_REPO"; do
  if [ ! -d "$repo/.git" ]; then
    if [ "$repo" = "$FRONTEND_REPO" ]; then
      echo "warning: $repo not found — the UI usage dimension will be empty. Clone it (read-only) with:"
      echo "  git clone https://github.com/flamingo-stack/openframe-oss-frontend.git $FRONTEND_REPO"
    else
      echo "warning: $repo not found; its surface is skipped"
    fi
    continue
  fi
  [ "$FETCH" = 1 ] && git -C "$repo" fetch origin --quiet --tags
  ref="$REF"
  [ "$repo" = "$FRONTEND_REPO" ] && ref="$FRONTEND_REF"
  echo "$(basename "$repo"): $ref = $(git -C "$repo" rev-parse --short "$ref") ($(git -C "$repo" log -1 --format=%ad --date=short "$ref"))"
done
echo "tests: $TEST_REF = $(git -C "$OSS_LIB_REPO" rev-parse --short "$TEST_REF")"

# ---------------------------------------------------------------- matrix
HIST_FLAG=""; [ "$HISTORY" = 1 ] || HIST_FLAG="--no-history"
PLAN_FILE="${PLAN_FILE:-$HERE/coverage-plan.toml}"
KNOWN_GAPS_FILE="${KNOWN_GAPS_FILE:-$HERE/known-gaps.md}"
HISTORY_LOG="${HISTORY_LOG:-$HERE/history.jsonl}"
# shellcheck disable=SC2086  # HIST_FLAG is intentionally word-split (empty or one flag)
python3 "$HERE/coverage_matrix.py" --root "$FLAMINGO_ROOT" --ref "$REF" --test-ref "$TEST_REF" \
  --frontend-ref "$FRONTEND_REF" --recent-days "$RECENT_DAYS" --out "$RESULTS_DIR" --run-date "$RUN_DATE" \
  --plan "$PLAN_FILE" --known-gaps "$KNOWN_GAPS_FILE" --history-log "$HISTORY_LOG" $HIST_FLAG
sed -n '/^## Totals/,/^## By area/p' "$RESULTS_DIR/coverage.md" | grep -E '^\| \*\*all\*\*|^After known gaps|^Burndown|^\*\*Next up' | cut -c1-240

if [ "$LLM" = 0 ]; then
  echo "matrix only (--no-llm): $RESULTS_DIR/coverage.md"
  exit 0
fi

# ---------------------------------------------------------------- resolved prompt
export RUN_DATE RESULTS_DIR RECENT_DAYS CLAUDE_MODEL FLAMINGO_ROOT PLAN_FILE KNOWN_GAPS_FILE HISTORY_LOG \
       OSS_LIB_REPO SAAS_LIB_REPO SAAS_SHARED_REPO SAAS_TENANT_REPO FRONTEND_REPO REF TEST_REF FRONTEND_REF
export ANALYSER_DIR="$HERE" ANALYSER_MODE=local
PROMPT="$RESULTS_DIR/prompt.resolved.md"
{
  echo "# RUN PARAMETERS"
  for v in RUN_DATE RESULTS_DIR ANALYSER_DIR FLAMINGO_ROOT OSS_LIB_REPO SAAS_LIB_REPO SAAS_SHARED_REPO \
           SAAS_TENANT_REPO FRONTEND_REPO REF TEST_REF FRONTEND_REF RECENT_DAYS PLAN_FILE KNOWN_GAPS_FILE \
           HISTORY_LOG ANALYSER_MODE CLAUDE_MODEL; do
    echo "$v=${!v}"
  done
  echo
  cat "$HERE/prompt.md"
} > "$PROMPT"

# ---------------------------------------------------------------- run Claude Code headless
# Unset the variables an enclosing Claude Code session exports, so a nested run is not refused.
# (bash 3.2 on macOS: "${arr[@]}" on an empty array trips `set -u`, hence the guarded expansion.)
UNSET=()
while IFS= read -r v; do UNSET+=(-u "$v"); done < <(env | cut -d= -f1 | grep -E '^(CLAUDECODE|CLAUDE_CODE_|CLAUDE_PID|CLAUDE_EFFORT)' || true)
echo "== claude -p ($CLAUDE_MODEL) started $(date -u +%FT%TZ) =="
started=$(date +%s)
set +e
( cd "$HERE" && env ${UNSET[@]+"${UNSET[@]}"} claude -p "$(cat "$PROMPT")" --output-format json \
    --dangerously-skip-permissions --model "$CLAUDE_MODEL" ) > "$RESULTS_DIR/claude-result.json"
rc=$?
set -e
echo "== claude exited $rc after $(( $(date +%s) - started ))s =="
python3 - "$RESULTS_DIR/claude-result.json" <<'PY'
import json, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception as e:  # noqa: BLE001
    print("claude-result.json is not JSON:", e); sys.exit(0)
print("turns:", d.get("num_turns"), "| cost_usd:", d.get("total_cost_usd"), "| duration_ms:", d.get("duration_ms"), "| session:", d.get("session_id"))
if d.get("is_error"):
    print("claude reported an error:", str(d.get("result", ""))[:500])
PY

# ---------------------------------------------------------------- results
echo "== results =="
if [ -f "$RESULTS_DIR/report.md" ]; then
  cat "$RESULTS_DIR/report.md"
else
  echo "no report.md was written; see $RESULTS_DIR/claude-result.json and run.log"
fi
echo "results: $RESULTS_DIR"
exit "$rc"
