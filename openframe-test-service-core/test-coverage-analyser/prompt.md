# Runbook: turn the API coverage matrix into a prioritised gap report

You are a headless Claude Code run started by `run-local.sh` with the
`openframe-test-service-core/test-coverage-analyser/` folder of openframe-oss-lib as working
directory. A `RUN PARAMETERS` block above this text gives concrete values for the names in ALL CAPS
below (RUN_DATE, RESULTS_DIR, ANALYSER_DIR, FLAMINGO_ROOT, OSS_LIB_REPO, SAAS_LIB_REPO,
SAAS_SHARED_REPO, SAAS_TENANT_REPO, FRONTEND_REPO, REF, TEST_REF, FRONTEND_REF, RECENT_DAYS). They are
also exported as environment variables. Work autonomously; nobody will answer questions. Whatever
happens, finish by writing `RESULTS_DIR/report.md`.

`coverage_matrix.py` has already run. Its output is your primary input:

| File | Content |
|---|---|
| `RESULTS_DIR/coverage.md` | the human summary: totals, the **Plan** section (burndown, every plan item scored, next up, unplanned gaps, known gaps applied), per-area table, the open-gap lists, drift, test inventory |
| `RESULTS_DIR/coverage.json` | the full matrix: `meta.refs` (the exact SHAs analysed), `rows[]` (one per product operation: `surface`, `key`, `sources` with the schema `args`/`returns`, `types`, `introduced`, `frontend[]` usages with the UI operation name, file and feature, `tests[]` with how each test reaches it, `client_methods`, `status`, `kg` = the known-gaps id that matched or null, `open` = uncovered and not under a known gap), `plan` (the scored plan: `items[]`, `next_up`, `unplanned_open_ui`, `unplanned_open_api`), `known_gaps`, `previous_run` (last history entry, for deltas), `drift`, `tests` (the test inventory, client-method graph, `dto_classes`, `test_classes`), `frontend` |
| `ANALYSER_DIR/known-gaps.md` | decisions already taken about surface that is out of scope, deferred, or accepted. **Already applied by the extractor**: rows carry `kg`, and the open-gap lists in `coverage.md` exclude matched rows |
| `PLAN_FILE` (`coverage-plan.toml`) | the backlog of test work items. Scored by the extractor on every run; human-owned status |
| `HISTORY_LOG` (`history.jsonl`) | one line per run with the totals and plan numbers; the extractor writes it and computes the deltas shown in the Plan section |

Repositories, all read-only, all at the SHAs in `coverage.json` `meta.refs`:

| Variable | Repository | Holds |
|---|---|---|
| OSS_LIB_REPO | openframe-oss-lib | the test library (`openframe-test-service-core`), the OSS service cores with their `*.graphqls` schemas and controllers |
| SAAS_TENANT_REPO | openframe-saas-tenant | per-tenant services: tickets/AI-agent schema, saas-api schema, gateway routes in `configs/base/openframe-saas-gateway.yml` |
| SAAS_SHARED_REPO | openframe-saas-shared | shared services, the test runner (`openframe/services/openframe-saas-test`) and its phase config `configs/base/openframe-saas-test.yml` |
| SAAS_LIB_REPO | openframe-saas-lib | SaaS library modules (image controller, tenant-info schema) |
| FRONTEND_REPO | openframe-oss-frontend | the dashboard app: Relay documents under `src/app/(app)/<feature>/…`, REST calls through `src/lib/api-client.ts` |

Read them through the read-only git shim in `ANALYSER_DIR`, never plain `git`:
`./git-ro -C $REPO show <sha>:<path>`, `./git-ro -C $REPO grep -n <pattern> <sha> -- '<glob>'`,
`./git-ro -C $REPO log <sha> …`. Never read a working tree: the checkouts sit on feature branches
with uncommitted work.

The shim takes the read-only subcommands only, and it is the single command this run may shell out
to — a plain `git`, any other program, and any pipe, redirection or `&&` chain are refused before
they run. Use git's own flags where you would reach for a pipe: `-n`/`--max-count` instead of
`| head`, `--format` instead of `| cut`, `git grep -c` instead of `| wc -l`.

## Rules (non-negotiable)

1. **Files you may write:** `RESULTS_DIR/**`, `ANALYSER_DIR/known-gaps.md`, and `PLAN_FILE` — in the
   plan file only by **appending** `[[items]]` tables with `status = "proposed"` and by extending the
   `notes` or `needs` of an existing item; never change an existing item's `status`, `priority`, `ops`,
   `id` or `test_class`. Nothing else. This milestone produces a report and a backlog; it does not add
   tests, clients, or DTOs (that is the scaffolding milestone).
2. **Git:** read-only, through `./git-ro`. Never check out, commit, push, or fetch. Rules 1 and 2
   are enforced by `run-guard.py`, not merely asked for: a refused call comes back as a hook error
   naming what was blocked. If you hit one, the answer is a different read, never a workaround.
3. **Facts, not assumptions.** Coverage numbers come from `coverage.json`. Operation contracts come
   from the schema or controller file at the pinned SHA — read it and quote the field or mapping line.
   Existing fixtures come from the test library at TEST_REF (`api/`, `data/`, `helpers/`). Say "not
   verified" when you did not look.
4. **Budget:** about 30 minutes of wall-clock. Ten well-specified proposals beat thirty vague ones.
   If time runs short, cut the proposal count, not the evidence per proposal.
5. **No questions.** Where a decision belongs to the suite owner, state the options under "Needs a
   decision".

## Step 1 — Read the matrix

Read `coverage.md` fully and load `coverage.json`. Record: the refs, the totals row, the per-area
table, the four drift lists, and the test-inventory line. Note which UI features (from
`rows[].ui_features`) have the lowest share of covered operations — that is where a user-visible
regression is most likely to go unnoticed.

Understand the status vocabulary before ranking anything:

- `covered` — at least one enabled test reaches the operation. `tests[].how` says whether the test
  calls the client method itself (`direct`), or reaches it through `setup` (`@BeforeAll/@BeforeEach`),
  a `base` class, or a `helper:<Class>`. Indirect coverage (login in `BaseTest`, device lookup in a
  generator) proves the call works, not that its behaviour is asserted; treat `direct` as real
  coverage and indirect as "smoke only" when judging depth.
- `gap-ui` — the dashboard app selects the field or calls the endpoint, no enabled test does.
- `gap-api` — neither the app nor a test touches it: external API v1, agent (`/clients/**`),
  auth-server, OAuth BFF, internal/operator endpoints, proxies.
- `covered-by-disabled-only` — only `@Disabled` tests reach it.

## Step 2 — Check the known gaps and the plan

The extractor has already matched `known-gaps.md` against the rows (`rows[].kg`) using the explicit
selectors in each entry: operation keys, operation names that are unique in the product, controller
class names, and path patterns. Two checks are yours:

- Read the "Known gaps applied" line. If an entry matched far more or fewer rows than its text
  implies, the entry's selectors are wrong — say so under "Needs a decision", do not silently widen
  or narrow the entry. Rows the matcher missed can be tagged by hand in the report.
- Do not re-argue entries. The rows with `open = true` are the **open gaps**.

Then read the Plan section and `PLAN_FILE`. Every open gap is either inside a plan item (the `plan`
column of the gap tables) or unplanned (`plan.unplanned_open_ui`, `plan.unplanned_open_api`). Items
already `planned` or `in-progress` are being worked; do not propose them again. Items whose
`computed` column says `REGRESSED` lost coverage since they were marked done — that is a finding,
report it first.

## Step 3 — Rank the open gaps

Rank on consequence, roughly in this order:

1. **P1** — `gap-ui` mutations (the UI can change state through it and nothing checks the result),
   `gap-ui` operations introduced within RECENT_DAYS (`rows[].introduced`), and any `gap-ui` operation
   in an area where **zero** operations are covered (a whole feature with no safety net).
2. **P2** — remaining `gap-ui` queries in areas that are partially covered; `gap-ui` REST endpoints.
3. **P3** — `gap-api` surface that is reachable through a tenant host and has an external consumer:
   external API v1 endpoints the suite does not call, agent endpoints under `/clients/**`,
   auth-server and OAuth BFF flows, plus `covered-by-disabled-only` and unreached client methods.

Adjust with evidence from git, for the areas of your top candidates only:
`./git-ro -C $REPO log <sha> --since="RECENT_DAYS days ago" --format='%h %ad %s' --date=short -- <schema file or controller file>`.
Fix commits (`fix|bug|regression|revert` in the subject) on an uncovered area raise its priority;
cite the commit. An area whose last change is over a year old and that the UI barely uses can drop.

Two more signals from the matrix, both cheap:

- `drift.client_methods_unreached` — API-client methods that already implement a call nobody
  exercises. A gap whose client method already exists is the cheapest to close; say so.
- The frontend usage on each row (`frontend[].op` and `frontend[].file`) tells you which screen
  depends on the operation. Prefer gaps behind screens the nightly UI tests do not open either.

## Step 3b — Grow the plan

The ranking from Step 3 is the input to the backlog. For every **unplanned** open gap that lands in
your top tier, group gaps into work items the way a person would pick them up: one item per feature
area and shared fixture set (one client class and one `Queries` class unlock every op behind them),
UI-used ops before API-only ops, and one item never larger than what one PR would carry (about a
dozen ops). Append each as a `[[items]]` table to `PLAN_FILE`, ids continuing the `CP-<n>` sequence,
`status = "proposed"`, with `ops` as exact matrix keys, `test_class`, `tags`, `depends_on` (the item
that creates the shared client, if any), `needs` (each decision or precondition as one string),
`source = "report RUN_DATE #<proposal number>"`, and a `notes` line with the one fact an implementer
must not miss. The extractor scores effort on the next run; do not write an effort field.

If an existing `proposed` item is superseded (its area gained ops, its ops were removed from the
product, or a decision recorded in its `needs` was answered in the code), append a dated sentence to
its `notes`; the owner decides whether to change its status.

## Step 4 — Specify the top proposals

For the top ten open gaps (P1 first; fewer if the budget forces it), write one proposal each with:

- **Operation** — key, area, module, and the UI feature(s) and Relay/REST operation names that use it.
- **Contract** — read the schema or controller at the pinned SHA and quote the signature: arguments
  and their types, return type, error shape (`userErrors`, thrown GraphQL error, HTTP status). For
  REST, the request/response DTO class names. Note anything the contract makes ambiguous.
- **Fixtures** — what the library already has: the API-client class and any method that already
  targets this operation (from `rows[].client_methods` and the `api/` sources), generators in `data/`,
  helpers, existing tests in the same area to extend. Then what is missing (a `Queries` constant, a
  client method, a DTO).
- **The test** — a `@DisplayName`, the class (existing or new, following the naming under
  `tests/`), the tags, and which nightly phase picks it up. Phase rule (from
  `configs/base/openframe-saas-test.yml` in SAAS_SHARED_REPO): the `functional` phase runs everything
  not tagged `registration`, `registration-negative`, `org-create`, `device`, `scheduled`, `archive`,
  `org-archive`, `admin-setup`, `admin-teardown`, `ai`, `external-api`; the other tags each have their
  own phase. Give the steps and the assertions, including at least one negative or boundary case
  where the contract defines one, and the cleanup that keeps the tenant reusable.
- **Risk** — destructive? irreversible (the external API's device status change is)? rate-limited
  (the qa external API key is limited to 5 requests per minute)? needs the enrolled Windows device or
  a second machine? collides with another test's data?

Keep each proposal under ~40 lines. A proposal that can be implemented without reading anything else
is the goal.

## Step 5 — Hygiene findings

Short bullets, each with the evidence:

- Operations reached only by `@Disabled` tests, and why each test is disabled if the source says.
- `drift.client_methods_unreached`: dead fixtures (never used, candidates to delete) versus
  ready-made calls waiting for a test.
- Consumer drift: UI calls with no product endpoint (possible dead UI code or a product bug — say
  which the evidence supports), UI schema fields absent from the product schemas, test calls that
  match nothing.
- Tests that contain an assumption (`assumes: true`) and therefore may self-skip in the nightly:
  which precondition they need.
- Areas with a large `gap-api` surface that the UI does not use at all: worth one line each stating
  what consumes them, so the owner can decide whether they belong in `known-gaps.md`.

## Step 6 — Write the report

Write `RESULTS_DIR/report.md`. The section above "Details" must stay under 3500 characters so it can
be pasted into Slack or a PR body.

```
*API coverage — RUN_DATE* (product REF at <sha7>, tests TEST_REF at <sha7>, UI FRONTEND_REF at <sha7>)
Matrix: <n> operations (<g> GraphQL fields, <r> REST endpoints) · UI uses <u> · covered <c> (<pct>%) · UI-used and covered <uc>/<u> · open gap-ui after known gaps <o> · introduced in the last RECENT_DAYS days and uncovered <k>
Plan: <ops> ops in <items> items (<by status>) · covered directly <d> · since <previous date>: covered <±n>, open UI gaps <±n> · next up: CP-a, CP-b, CP-c · proposed this run: CP-x … CP-y (<n> items, <m> ops) · unplanned open UI gaps left: <n>

| # | Gap | P | Area / module | UI feature | Why now | Proposal |
|---|---|---|---|---|---|---|
| 1 | `mutation:updateScriptSchedule` | P1 | script-schedule / openframe-api-service-core | scripts | 3 fix commits since <date>; whole schedule area uncovered | CP-1: extend ScriptsTest: create → update cron → assert next run; ScriptApi.updateSchedule |
| … |

*Areas with no coverage at all:* <list with op counts>
*Known gaps applied:* KG-n (<count> ops), …
*Needs a decision:* <bullets, including every `needs` string of a proposed or planned item that blocks it>
*Hygiene:* <two or three bullets, rest under Details>

Details
<one proposal per top gap, as specified in Step 4, each naming its plan item id>
<plan changes made in this run: items appended, notes added>
<hygiene findings>
<known-gaps changes made in this run, if any>
```

Then, if you found a structural exclusion that is clearly not the suite's business (a new internal
controller, a new federation field), append a `KG-n` entry to `ANALYSER_DIR/known-gaps.md` in the
existing format, marked *proposed*. Never edit or reclassify an existing entry; propose the change
in the report instead.

## Step 7 — Final output

Your final message must be the contents of `RESULTS_DIR/report.md`, verbatim, and nothing else.

## Appendix — where things live in the test library (TEST_REF)

```
openframe-test-service-core/src/main/java/com/openframe/test/
  api/            one static client class per resource (TicketApi, DeviceApi, …); auth/ holds the login flows;
                  external/ the X-API-Key clients; graphql/ the GraphQL documents as Java text-block constants
  config/         EnvironmentConfig (base URLs, GRAPHQL and CHAT_GRAPHQL paths), ExternalApiConfig, MachineConfig
  data/           DTOs by domain and the *Generator classes that build request payloads
  helpers/        AuthHelper (session cookies), RequestSpecHelper (REST Assured specs), ai/ (assistant sessions)
  tests/          JUnit 5 classes extending BaseTest; ai/, external/, ui/ sub-packages; tags select phases
  pages/          Playwright page objects (UI tests only)
```

Conventions: static client methods; GraphQL documents as `public static final String` text blocks in
`api/graphql/<Area>Queries.java`; DTO fields verified against the schema, not guessed; `@DisplayName`
strings are what the Slack report shows; external API display names start with `ExtApi: `.
