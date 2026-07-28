# AI Assistant E2E Suite — Implementation Plan

**Audience:** an implementing agent (Claude Code) or engineer building the suite.
**Deliverable:** a standalone Maven module `openframe-saas-ai-agent-e2e` — a black-box harness plus the scenarios defined in the catalog.

**Document set — read all three before writing code:**

| Doc | Role |
|---|---|
| `docs/ai-testing-strategy.md` | Why the suite is shaped this way |
| `docs/ai-e2e-test-cases.md` | **Source of truth for all 60 test cases** |
| `docs/ai-e2e-test-plan.md` (this) | Harness architecture and build order |

This document does **not** restate the cases. If the two ever disagree, the catalog wins.

---

## 0. Read this first — the three rules

1. **Assert on outcomes, never on the command string.** "Create a file" may produce `touch`, `echo >`, `printf >`, `cat <<EOF`, or `New-Item`. All correct. Assert the *file exists with the expected content*. Never assert on the generated command, and never assert on the tool name unless the case explicitly tests routing (only `WEB-01`, `WEB-02`, `CAP-*` do).
2. **Two-channel verification.** The prompt goes in via the product REST API. The assertion comes back via an **independent channel** — SSH/WinRM onto the machine, or the entity's own read API. The assistant's own text is a **diagnostic signal only**; it must never be the reason a test passes. A hallucinated "Done, I created the file" must fail.
3. **Classify failures.** Machine offline, agent not reporting, dispatch timeout, LLM 5xx → `InfraFailureException` → the run **aborts** with a diagnostic and does not fail the build. Assistant did the wrong thing → assertion failure → **fails the build**. Without this split the suite becomes noise and gets ignored.

---

## 1. Module layout

```
openframe-saas-ai-agent-e2e/
├── pom.xml
└── src/test/
    ├── java/com/openframe/ai/e2e/
    │   ├── client/          # channel A — drive the product
    │   │   ├── AuthClient.java
    │   │   ├── DialogClient.java
    │   │   ├── MessageClient.java
    │   │   ├── ApprovalClient.java
    │   │   ├── GraphQlClient.java
    │   │   └── entity/  TicketApiClient, ScriptApiClient, ScheduleApiClient,
    │   │                MdmPolicyApiClient, MdmQueryApiClient, KbApiClient,
    │   │                TagApiClient, DirectoryApiClient, MachineApiClient
    │   ├── verify/          # channel B — independent verification
    │   │   ├── MachineVerifier.java          (interface)
    │   │   ├── SshMachineVerifier.java
    │   │   └── WinRmMachineVerifier.java
    │   ├── harness/
    │   │   ├── AssistantRunner.java          # the core: ask() -> RunResult
    │   │   ├── RunResult.java
    │   │   ├── RunWaiter.java
    │   │   ├── ApprovalPolicy.java           # AUTO_APPROVE | AUTO_REJECT | MANUAL
    │   │   └── RunId.java
    │   ├── fixture/
    │   │   ├── MachineFixture.java
    │   │   ├── DialogFixture.java
    │   │   ├── SeedHelper.java
    │   │   └── Janitor.java
    │   ├── support/
    │   │   ├── E2eConfig.java
    │   │   ├── BaseE2eTest.java
    │   │   ├── InfraFailureException.java
    │   │   ├── Assertions.java               # assertNoFalseSuccess, assertExactSet
    │   │   └── PassRateExtension.java
    │   └── scenario/        # one class per catalog category (A–M)
    └── resources/
        └── e2e.properties
```

Dependencies: JUnit 5, AssertJ, Awaitility, Jackson, an HTTP client (JDK `HttpClient` suffices), `com.hierynomus:sshj`, and a WinRM client for category M. Keep it thin. **Do not depend on the service module** — this is a black-box suite.

---

## 2. Harness components

### 2.1 `E2eConfig`
Reads system properties / env. No defaults for secrets. Fail fast at startup with a clear message naming any missing key.

| Key | Meaning |
|---|---|
| `e2e.api.baseUrl` | Gateway base URL for the test tenant |
| `e2e.graphql.url` | GraphQL endpoint |
| `e2e.auth.*` | Whatever the gateway needs to mint a test-account JWT |
| `e2e.machine.linux.*` | id, host, sshUser, sshKeyPath — primary target |
| `e2e.machine.control.*` | Control machine, for scoping assertions |
| `e2e.machine.windows.*` | id, host, winrmUser, winrmPassword |
| `e2e.org.*` / `e2e.user.*` | Known org and user for discovery cases |
| `e2e.timeout.runSeconds` | Default run wait; suggest 180 |
| `e2e.runs` | N repetitions per case; default 3 |

### 2.2 `AssistantRunner` — the core abstraction

```java
RunResult ask(String prompt);
RunResult ask(String prompt, ApprovalPolicy policy);
```

1. `POST /api/v1/messages` with `{dialogId, chatType, content}` — returns immediately with the *user* message id.
2. Wait for a terminal state (see `RunWaiter`).
3. On `ApprovalRequestData`: `AUTO_APPROVE` → `POST /api/v1/approval-requests/{id}/approve {"approve": true}` and keep waiting. `AUTO_REJECT` → `false`. `MANUAL` → return so the test drives it.
4. Collect the message list via GraphQL and build `RunResult`.

### 2.3 `RunWaiter` — and the race you must handle

> **`dialog(id).streamState` derives from `dialogLockService.isLocked(dialogId)`.** `POST /messages` returns *before* the `@Async` run acquires the lock, so `streamState` reads `IDLE` immediately after sending. A naive "poll until IDLE" passes instantly against an empty conversation.

Poll GraphQL `messages(dialogId, chatType)` for a **terminal marker** — a final assistant `TextData` newer than the user message we sent — with an overall timeout. On timeout, throw `InfraFailureException`.

```graphql
query($dialogId: String!, $chatType: ChatType!) {
  messages(dialogId: $dialogId, chatType: $chatType, pagination: {limit: 50}) {
    edges { node {
      id createdAt
      owner { type }
      messageData {
        __typename
        ... on TextData { text }
        ... on ExecutingToolData { toolFunction parameters requiresApproval }
        ... on ExecutedToolData { toolFunction result success toolExecutionRequestId }
        ... on ApprovalRequestData { approvalRequestId command explanation approvalType }
        ... on ApprovalResultData { approvalRequestId approved }
        ... on ErrorData { error details }
      }
    } }
  }
}
```

### 2.4 `RunResult`
`finalText()`, `executedTools()`, `approvalRequests()`, `errors()`, `toolWasCalled(String)`, `anyWriteToolExecuted()`, `rawMessages()`. Give it a `toString()` that dumps the whole conversation — that dump is what an engineer reads when a nightly run fails.

### 2.5 `MachineVerifier` — channel B

```java
interface MachineVerifier {
    ExecResult exec(String command);
    boolean fileExists(String path);
    String readFile(String path);
    void writeFile(String path, String content);   // seeding
    void deleteQuietly(String path);
    boolean serviceRunning(String service);
    String hostname();
}
```

Any transport failure here is `InfraFailureException`, never an assertion failure — if we can't reach the box, we don't know whether the assistant did its job.

### 2.6 `MachineFixture`
Before each device scenario, assert the target machine is **online**.

> `NativeBulkCommandRunner` filters to online machines before dispatch and fails with **"No online machines found"** otherwise. An offline target produces an assistant-level error that looks like a behavioral bug. Check up front and abort as infra.

### 2.7 `DialogFixture` — machine targeting (critical)

> **`SendMessageRequest` has no `machineId` field.** The target is resolved server-side by `MachineIdResolverService`:
> - `ActorType.AGENT` → `machineId` claim from the JWT
> - `ActorType.ADMIN` → `dialog.ticketId` → `Ticket.deviceId`
>
> `contextItems: [{type: DEVICE, id: …}]` only enriches the prompt *text*; it does **not** set the execution target.

`DialogFixture.forMachine(machineId)` must: create a ticket with `deviceId = machineId`, create the dialog with that `ticketId` and `chatType = ADMIN_AI_CHAT`, and register both with the `Janitor`. **ADMIN-with-ticket is the default targeting mode** — it mirrors real technician usage.

### 2.8 `RunId` and `Janitor`
`RunId.next()` → short unique token (e.g. `e2e-3f9a2c`). Every artifact embeds it: file paths, ticket titles, script names, tag keys, file contents, policy names.

`Janitor` registers cleanup actions and runs them in `@AfterEach` **including on failure**. Also provide a standalone sweep entry point that deletes any `e2e-*` artifact older than 24h — failed runs leave debris on real machines.

### 2.9 Shared assertions
Two helpers used across many cases, worth building once:
- `assertNoFalseSuccess(runResult, actualStateOk)` — fails when the assistant claims success but the independent channel disagrees. Apply as a secondary assertion on every device case.
- `assertExactSet(actual, expected)` — for all scoping cases (`FLEET-03`, `DISC-*`, `SCHED-02`, `MDM-POL-03/04`, `NEG-BLAST-*`). Must fail on both over- and under-reach.

### 2.10 `PassRateExtension`
Run each case N times (default 3), record per-case pass rate, apply the catalog's threshold, and emit a JSON report so CI can diff against the last green baseline. Surface 2-of-3 cases distinctly as **flaky** — that usually means an ambiguous prompt or tool description, not a test bug.

---

## 3. Test cases

**See `docs/ai-e2e-test-cases.md` — 60 cases across categories A–M, each with prompt, preconditions, verification channel, and priority.** Implement one scenario class per category. Do not duplicate case definitions into code comments; reference the case ID.

Gating thresholds and phasing are defined in that document.

---

## 4. Build order

1. **`E2eConfig`, `AuthClient`, `GraphQlClient`, `MachineFixture`, `SshMachineVerifier`.** Prove you can authenticate, read a dialog, and reach the box.
2. **`DialogFixture` (ticket-based targeting) + `AssistantRunner` + `RunWaiter`.** The `streamState` race lives here — solve it once.
3. **`FILE-01` end to end.** *This is the milestone.* One test that sends a prompt and verifies a real file on a real machine exercises the entire chain. **Do not build breadth before this passes reliably three times in a row.**
4. **`Janitor` + `RunId`**, retrofitted into `FILE-01` before adding cases.
5. **Category A, then B.**
6. **Category E** — safety negatives, highest value.
7. **Categories D, F, G, H, I, K** — API-verified, fast, broad.
8. **`PassRateExtension`, JSON reporting, CI schedule.**
9. **Categories C, J, L, M.**

---

## 5. Blocking prerequisites

Implementation cannot start past step 1 without these. See `docs/ai-e2e-kickoff.md` for the checklist to fill in.

1. Test tenant, confirmed isolated from production.
2. Three enrolled always-on machines: Linux target, Linux control, Windows target.
3. Verification access to those boxes from CI — SSH keys, WinRM creds, bastion.
4. A way to mint a JWT for a test service account against the real gateway.
5. Known fixture data for discovery cases: an org with known membership, a user, a decoy hostname.
6. Approval stance: default `AUTO_APPROVE`, with `NEG-REJECT-01` the deliberate exception. **Do not couple the harness to guardrail internals** — that subsystem is being replaced. Interact with it only through the public approval endpoint.
