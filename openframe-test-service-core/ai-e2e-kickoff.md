# AI Assistant E2E — Claude Code Kickoff

Everything needed to start building. Fill in §1, then paste the §3 prompt into Claude Code at the repo root.

---

## 1. Environment checklist — fill this in first

Claude Code cannot get past the first milestone without these. Fill in what you know; mark the rest **TBD** so the agent asks rather than inventing values.

**Test tenant**
- [ ] Gateway base URL: `________`
- [ ] GraphQL endpoint: `________`
- [ ] Confirmed isolated from production: ☐

**Machines** (all enrolled and online)
- [ ] Linux target — machine id `______`, host `______`, SSH user `______`, key path `______`
- [ ] Linux control — machine id `______`, host `______`, SSH access `______`
- [ ] Windows target — machine id `______`, host `______`, WinRM user/password `______`

**Auth**
- [ ] How the harness mints a test-account JWT: `________`
- [ ] Test service account has ADMIN actor type: ☐

**Fixture data** (for discovery and scoping cases)
- [ ] Organization with known machine membership: `________`
- [ ] A user findable by email/name: `________`
- [ ] A decoy hostname near-identical to the target (for `NEG-AMBIG-01`, `DISC-01`): `________`
- [ ] A tag applied to exactly one of the two Linux machines (for `FLEET-03`, `DISC-03`): `________`

**Entity APIs** — Claude Code must discover these; note any it should not call
- [ ] Read APIs available for: tickets ☐ scripts ☐ schedules ☐ MDM policies ☐ MDM queries ☐ KB ☐ tags ☐ orgs/users ☐

**Decisions already made** (no need to revisit)
- Targeting mode: **ADMIN-with-ticket** (dialog bound to a ticket whose `deviceId` is the target)
- Approval stance: **AUTO_APPROVE** by default; `NEG-REJECT-01` is the exception
- Guardrails: **do not couple to internals** — that subsystem is being replaced; use only the public approval endpoint

---

## 2. Document set

| Doc | Role |
|---|---|
| `docs/ai-testing-strategy.md` | Why the suite is shaped this way |
| `docs/ai-e2e-test-cases.md` | **Source of truth — all 60 cases** |
| `docs/ai-e2e-test-plan.md` | Harness architecture and build order |
| `docs/ai-e2e-kickoff.md` (this) | Environment checklist and kickoff prompt |

---

## 3. Kickoff prompt

Paste this into Claude Code at the repo root:

> Read `docs/ai-testing-strategy.md`, `docs/ai-e2e-test-plan.md`, and `docs/ai-e2e-test-cases.md` in full before writing any code. `ai-e2e-test-cases.md` is the source of truth for test cases; the plan defines harness architecture.
>
> Build the `openframe-saas-ai-agent-e2e` Maven module as a **black-box** suite — it must not depend on the service module's classpath.
>
> **Scope for this session: build order steps 1–3 only.** That is: config, auth, GraphQL and SSH clients, machine and dialog fixtures, `AssistantRunner`, `RunWaiter`, and exactly one working test — `FILE-01`. Do not implement any other case. Do not build breadth before `FILE-01` passes reliably.
>
> Three rules that override any convenient shortcut:
> 1. Assert on outcomes, never on the generated command string or tool name (except `WEB-*` and `CAP-*`, which are out of scope this session).
> 2. Two-channel verification — drive via the REST API, verify via SSH. The assistant's own text can never be the reason a test passes.
> 3. Classify failures — unreachable machine, offline agent, dispatch timeout, LLM 5xx are `InfraFailureException` and abort the run; only genuine behavioral wrongness fails the build.
>
> Two known landmines, both documented in the plan — handle them explicitly:
> - `SendMessageRequest` has no `machineId`. The execution target resolves from `dialog.ticketId → Ticket.deviceId` for ADMIN actors, so the dialog fixture must create a ticket bound to the target device.
> - `dialog.streamState` reads `IDLE` before the async run acquires its lock, so polling until `IDLE` passes instantly against an empty conversation. Wait for a terminal assistant message newer than the user message instead.
>
> Environment values are in §1 of `docs/ai-e2e-kickoff.md`. **Where a value is marked TBD, stop and ask — do not invent URLs, credentials, hostnames, or API paths.** Where an entity read API is needed and you cannot find it in the codebase, ask rather than guessing the shape.
>
> Match existing repo conventions: JUnit 5, AssertJ, the `*IT` naming and tag pattern used elsewhere in this service. Start by proposing the module skeleton and `pom.xml` for review before implementing.

---

## 4. Session plan after the first milestone

Keep sessions narrow; each builds on a proven base.

| Session | Scope | Done when |
|---|---|---|
| 1 | Harness + `FILE-01` | `FILE-01` passes 3× consecutively |
| 2 | `Janitor`, `RunId`, shared assertions; category A | Cleanup verified on failure paths |
| 3 | Category B; `PassRateExtension` + JSON report | Per-case pass rates emitted |
| 4 | Category E (safety negatives) | All P0 negatives green |
| 5 | Categories D, F (API-verified breadth) | — |
| 6 | Categories G, H, I, K | — |
| 7 | Categories C, J, L, M; CI schedule | Nightly run wired up |

---

## 5. Guardrails for the agent

Worth restating in-session if the agent drifts:

- **No breadth before depth.** One passing end-to-end case beats twelve half-wired ones. The whole suite's credibility rests on `FILE-01` being genuinely trustworthy.
- **No mocking the assistant.** If a test would pass with the LLM stubbed out, it belongs in a different suite.
- **No asserting on prose.** Reply text is checked only for specific tokens we planted (`SECRET-{id}`) or real values read from the box (hostname), never for phrasing.
- **Cleanup is not optional.** These tests write to real machines. A case without teardown is a bug.
- **Ask, don't assume.** Missing URL, credential, or API shape → stop and ask. A plausible-looking invented endpoint costs more than the question.
