# test-coverage-analyser

Finds the gaps in the E2E suite's **API coverage**: which GraphQL operations and REST endpoints the
product exposes, which of those the dashboard UI actually calls, and which ones no test in
`openframe-test-service-core` ever reaches. The output is a matrix (deterministic, ~25 s) and a
prioritised report with concrete test proposals (Claude Code, headless). Design and the roadmap are in
[PLAN.md](PLAN.md).

## What is here

| File | Purpose |
|---|---|
| `coverage_matrix.py` | The extractor. Reads five repositories at pinned refs (never a working tree), builds the product surface, the UI usage and the test usage, joins them, writes `coverage.json` + `coverage.md`. Stdlib only. |
| `run-local.sh` | The manual trigger. Fetches the repos read-only, runs the extractor, runs Claude Code headless on `prompt.md`, prints the report. |
| `prompt.md` | The runbook Claude follows: read the matrix → apply known gaps → rank → specify the top proposals → hygiene → write `report.md`. |
| `known-gaps.md` | Surface that is out of scope, deferred, or accepted, with the reason. Applied mechanically by the extractor (see the matching rules at the top of the file); extended by the analyser (entries marked *proposed* until confirmed). |
| `coverage-plan.toml` | The backlog: work items that close gaps, each listing the matrix keys it covers. Scored by the extractor on every run; status is human-owned. Seeded from the 2026-09-12 report (CP-1 … CP-10). |
| `history.jsonl` | One line per run date with the totals and plan numbers. Written by the extractor; the source of the deltas in the Plan section. Small, committed. |
| `results/<date>/` | `coverage.md`, `coverage.json`, `report.md`, `run.log`, `claude-result.json`. **Gitignored** — see below. |

## Prerequisites

- The four product checkouts next to each other (`openframe-oss-lib`, `openframe-saas-lib`,
  `openframe-saas-shared`, `openframe-saas-tenant`) plus the dashboard app, cloned read-only as a
  sibling: `git clone https://github.com/flamingo-stack/openframe-oss-frontend.git`. The script walks
  up from its own location to find them; override with `FLAMINGO_ROOT` or the per-repo variables.
- `python3` (3.9+), `git`. The Claude Code CLI logged in, for the report step only.

## Run

```
./run-local.sh                                   # matrix + report for today, everything at origin/main
./run-local.sh --no-llm                          # matrix only, no Claude run
./run-local.sh --test-ref origin/test/my-branch  # score the tests on a branch before merging
./run-local.sh --recent-days 14 --no-fetch       # narrower "recently added" window, skip fetching
```

Options: `--ref`, `--test-ref`, `--frontend-ref` (default `origin/main`), `--date`, `--recent-days`
(30), `--no-history` (skip per-operation "introduced" dates; the run drops from ~25 s to ~6 s),
`--model` (default `claude-opus-5`, or `CLAUDE_MODEL`), `--no-fetch`, `--no-llm`.

The extractor can be run alone:

```
python3 coverage_matrix.py --root ~/sandbox/flamingo --out results/2026-09-12 [--no-history]
```

## How coverage is decided

Three inventories, all from git at the refs recorded in `coverage.json` `meta.refs`:

- **Product surface** — every `Query`/`Mutation` field in `src/main/resources/**/*.graphqls` across the
  four repos (225 at the first run), and every `@RestController`/`@Controller` mapping in `src/main/java`
  (227 method+path pairs across 65 controllers). Each operation carries the first commit date that
  introduced its field or mapping line, so "added in the last N days" is a column, not a guess.
- **UI usage** — every root field selected by a Relay `graphql\`` document or a raw `` `#graphql `` string
  in `openframe-oss-frontend/src` (fragments on `Query` count, spreads are resolved), and every path
  sent through `apiClient.<method>(…)` or `fetch(…)`. Each usage is attributed to a UI feature from its
  path (`src/app/(app)/<feature>/…`).
- **Test usage** — the GraphQL text blocks in `api/graphql/*Queries.java`, the REST paths built from the
  constants in `api/**` (with `.concat`, `+` and `String.format` folded), and a call graph from each
  `@Test` method to the client methods it reaches: directly, through `@Before*` setup, through a base
  class, through helpers (transitively), and through client-to-client calls including fluent instance
  chains such as `AuthFlow.login`.

REST paths are matched after normalising path variables and after stripping the gateway prefix the
consumer uses (`api/`, `chat/`, `clients/`, `external-api/`, `sas/`, `tools/`), because the product
paths are service-relative. Catch-all proxies (`tools/{toolId}/**`) match by prefix.

Statuses: `covered` (an enabled test reaches it), `gap-ui` (the app uses it, no test does), `gap-api`
(nobody touches it), `covered-by-disabled-only`. The report distinguishes `direct` reach from
indirect (`setup`, `base`, `helper:<Class>`): indirect proves the call works, not that its behaviour
is asserted.

## The plan: turning gaps into work

`coverage-plan.toml` holds work items (`[[items]]`), one per feature area and shared fixture set,
each listing the matrix keys it closes, a priority, the target test class and tags, `depends_on`
(other items that create the fixtures it needs), and `needs` (decisions or preconditions it waits on).
`status` is `proposed`, `planned`, `in-progress`, `done` or `dropped` and is only ever changed by a
person. Every run scores the plan and writes the **Plan** section at the top of `coverage.md`:

- `computed` is what the matrix proves: `done` only when every op in the item is reached by a direct,
  enabled test; `partial` or `open` otherwise. An item marked `done` in the file whose computed status
  is not `done` is flagged `REGRESSED`.
- `effort` is derived from the fixtures still missing per uncovered op — a `Queries` constant, a client
  method, up to two DTO types (checked by name against `data/**`) — plus 2 for a missing test class.
  S ≤ 4 points, M ≤ 12, L above. `score` is UI-used ops (other ops weigh a quarter) per effort point.
- **Next up** lists the three unblocked items to pick first: `in-progress` before `planned` before
  `proposed`, then priority, then score. Blocked items (a `depends_on` not done) are held back.
- `drift` warns when an item names ops the product no longer has, or when its areas gained open
  ops that no item covers.
- The burndown line compares with the previous run in `history.jsonl`.

The headless run (Step 3b of `prompt.md`) grows the plan: unplanned open gaps in its top tier are
appended as new `proposed` items with exact keys, a test class, dependencies and the decisions they
wait on. It never changes an existing item's status, priority or ops. Promote `proposed` to `planned`
by editing the file; when the tests land, the next run proves the item `done` on its own.

Since the tests themselves live in this module and every test PR already triggers the library
release, plan and history updates should ride along in the same PRs.

## First run — 2026-09-12 (product and tests at `origin/main`, UI at `origin/main`)

| surface | operations | covered | gap-ui | gap-api | used by UI | UI-used and covered |
|---|---|---|---|---|---|---|
| GraphQL fields | 225 | 48 | 122 | 54 | 169 | 46 |
| REST endpoints | 227 | 71 | 30 | 126 | 41 | 11 |
| all | 452 | 119 | 152 | 180 | 210 | 57 |

UI-facing areas with **no** coverage at all (UI-used ops in brackets): script-schedule (12),
time-tracking (12), tenant/billing (11, deferred — KG-3), onboarding (8), AI settings (7),
notification (7), SSO config REST (5), organization AI settings (4), script-execution (4), AI policy
REST (4), assignment (3), guardrails (3), push (3, deferred — KG-9), AI configuration REST (3).
Tickets: the UI uses 28 of 41 operations, 9 are covered. A software-schedule schema (10 mutations)
landed in oss-lib on the day of the run with no UI usage and no tests yet.

## After the first day of plan work — 2026-09-13

| surface | operations | covered | gap-ui | gap-api | used by UI | UI-used and covered |
|---|---|---|---|---|---|---|
| all | 452 | 224 | 64 | 164 | 210 | 146 |

Of the 64 UI-used operations still uncovered, 21 are excluded by decision in `known-gaps.md`
(billing 11, mobile push 4, AI policies 4, plumbing 1, image upload 1), 1 sits in a plan item awaiting
a decision (CP-14, bulk archive of resolved tickets), and 43 are open outside the plan: onboarding 8,
SSO configuration REST 5, organization AI settings 4, user management REST 4, assignments 3,
organization guardrails 3, AI configuration REST 3, and smaller clusters. Plan items CP-1 … CP-18 are
done except CP-7 (dropped, postponed) and CP-14; see `coverage-plan.toml`. The jump from 185 to 224
covered on the last run of the day is partly the extractor learning to resolve method-local path
variables, which revealed REST endpoints that had been tested all along.

The tests behind those numbers are split across review branches, one per area, each named in the
`branch` field of its plan item: `test/coverage-script-schedules`, `test/coverage-time-notifications`,
`test/coverage-ai-settings`, `test/coverage-tickets`, `test/coverage-scripts-executions` and
`test/coverage-kb-tags-rest`. Reproducing the table takes a `--test-ref` pointing at a tree that has
all of them; scoring one branch alone reports only that branch's share.

## Known gaps and limits

- **UI ref vs deployed UI.** The app is read at `origin/main`; the deployed frontend image
  (`.openframe-saas.frontend.image.tag`, 1.0.92 in tenant qa at the first run) is built outside these
  repos and cannot be mapped to a commit. "The UI uses it" means "the app's main branch uses it".
- **Not seen:** WebSocket/NATS/SSE channels, Spring Cloud Gateway routes that are not controllers
  (`/v0/fleet/enrichment/**`), Spring Security filter endpoints (`POST sas/login` — expected drift,
  KG-8), fields added by resolvers without a schema entry, endpoints whose path is a Java constant
  outside the controller file.
- **Depth is not measured.** A `covered` operation may have one happy-path call and no negative case.
  The report's proposals ask for a negative or boundary case per gap; measuring depth is milestone 2.
- **Attribution is by name.** Instance calls (`.startFlow()`) are credited to every referenced client
  class that defines a method of that name; static calls resolve exactly.
- **The report step spends the operator's Claude session quota.** The first attempt on 2026-09-12 was
  cut off by "You've hit your session limit" (HTTP 429) after 18 turns; `run.log` and
  `claude-result.json` record it. Run it when the window is fresh, or use `--no-llm` and read
  `coverage.md` directly.
- **This folder sits inside the `openframe-test-service-core/**` path filter** of `.github/workflows/changes.yaml`,
  so any push to `main` that touches it triggers the oss-lib Java release. Run outputs are therefore
  gitignored; commit only tooling changes here, and expect a library version bump when you do.
