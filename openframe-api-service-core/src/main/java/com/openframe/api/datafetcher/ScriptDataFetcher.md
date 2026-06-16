# RMM API — Frontend Contract

GraphQL operations for managing saved scripts and dispatching shell commands to machines.

Schema files in this module: `src/main/resources/schema/script.graphqls` and `command.graphqls`.

`tenantId` is implicit — never send it in any input.

---

## Enums

```graphql
enum ScriptShell    { POWERSHELL  CMD  BASH  PYTHON  NUSHELL  SHELL }
enum ScriptPlatform { WINDOWS  LINUX  MACOS }
enum ScriptStatus   { ACTIVE  ARCHIVED  DELETED }
enum PrivilegeLevel { USER  ADMIN }
```

---

## Types

```graphql
type Script {
  id: ID!
  name: String!
  description: String
  shell: ScriptShell!
  scriptBody: String!
  tag: String
  supportedPlatforms: [ScriptPlatform!]
  defaultTimeoutSeconds: Int
  defaultArgs: [String!]
  envVars: [ScriptEnvVar!]
  status: ScriptStatus           # ACTIVE | ARCHIVED | DELETED
  statusChangedAt: Instant
  createdAt: Instant
  updatedAt: Instant
}

type ScriptEnvVar {
  name: String!
  value: String
  secret: Boolean!
}

type ScriptConnection {
  edges: [ScriptEdge!]!
  pageInfo: PageInfo!
}

type ScriptEdge {
  node: Script!
  cursor: String!
}

type CommandDispatchResponse { executionId: ID! }
type CancelDispatchResponse  { executionId: ID! }
```

---

## Inputs

```graphql
input CreateScriptInput {
  name: String!
  description: String
  shell: ScriptShell!
  scriptBody: String!
  tag: String
  supportedPlatforms: [ScriptPlatform!]
  defaultTimeoutSeconds: Int
  defaultArgs: [String!]
  envVars: [ScriptEnvVarInput!]
}

# PUT — full replacement. Required fields cannot be null;
# optional fields sent as null clear the stored value.
# The target script id travels INSIDE the input (no separate `id` argument).
input UpdateScriptInput {
  id: ID!
  name: String!
  description: String
  shell: ScriptShell!
  scriptBody: String!
  tag: String
  supportedPlatforms: [ScriptPlatform!]
  defaultTimeoutSeconds: Int
  defaultArgs: [String!]
  envVars: [ScriptEnvVarInput!]
}

input ScriptEnvVarInput {
  name: String!
  value: String
  secret: Boolean!
}

# All fields optional. statuses behaviour:
#   null / empty → DELETED scripts are hidden
#   non-empty   → used verbatim, no implicit exclusion
input ScriptFilterInput {
  shells: [ScriptShell!]
  statuses: [ScriptStatus!]
  supportedPlatforms: [ScriptPlatform!]
  tag: String                          # exact-match, case-insensitive
}

input RunCommandInput {
  machineId: String!
  shell: ScriptShell!
  command: String!
  privilegeLevel: PrivilegeLevel!
  timeoutSeconds: Int                  # null → agent default
}

input CancelExecutionInput {
  machineId: String!
  executionId: ID!
}
```

---

## Queries

```graphql
# Single script by id. Returns null if missing, soft-deleted, or in another tenant.
query Script($id: ID!) {
  script(id: $id) {
    id name description shell scriptBody tag
    supportedPlatforms defaultTimeoutSeconds defaultArgs
    envVars { name value secret }
    status statusChangedAt createdAt updatedAt
  }
}

# Cursor-paginated list (Relay Connection Spec).
# Sortable fields: _id (default), name, createdAt, updatedAt.
# search: case-insensitive substring on name.
query Scripts(
  $filter: ScriptFilterInput
  $search: String
  $sort: SortInput
  $first: Int, $after: String
  $last: Int, $before: String
) {
  scripts(filter: $filter, search: $search, sort: $sort,
          first: $first, after: $after, last: $last, before: $before) {
    edges {
      node { id name shell tag status updatedAt }
      cursor
    }
    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
  }
}
```

---

## Mutations

### Script CRUD

```graphql
mutation CreateScript($input: CreateScriptInput!) {
  createScript(input: $input) { id name shell createdAt }
}

# PUT semantics — send the full intended new state. The script id is a field of the input.
mutation UpdateScript($input: UpdateScriptInput!) {
  updateScript(input: $input) { id name shell updatedAt }
}

# Soft-delete (status → DELETED). Idempotent. Returns the id of the deleted script.
mutation DeleteScript($id: ID!) {
  deleteScript(id: $id)
}
```

### Command dispatch

```graphql
# Run an ad-hoc shell command on a target machine. Nothing persisted server-side.
mutation RunCommand($input: RunCommandInput!) {
  runCommand(input: $input) { executionId }
}

# Cancel an in-flight execution.
mutation CancelExecution($input: CancelExecutionInput!) {
  cancelExecution(input: $input) { executionId }
}
```

### Running a saved script

There is no dedicated `runScript` mutation. To dispatch a saved script:

1. Fetch the script via `script(id)`.
2. Compose `RunCommandInput` from the fetched fields:

```ts
runCommand({
  machineId,
  shell:          script.shell,
  command:        script.scriptBody,
  privilegeLevel: USER | ADMIN,                          // dashboard decides
  timeoutSeconds: overrideTimeout ?? script.defaultTimeoutSeconds,
})
```

`defaultArgs` and `envVars` from the script are NOT yet wired through this path — `runCommand` doesn't accept them in the current schema. If you need them, flag it back to the backend team.

---

## Behavioural notes (not visible from the schema)

- **`scripts(...)` filter — `statuses` hidden default:** if you don't pass it (or pass `[]`), `DELETED` rows are excluded. To show deleted, pass an explicit list, e.g. `[ACTIVE, ARCHIVED, DELETED]`.
- **`updateScript` is PUT, not PATCH.** Required fields must always be present. Nulls on optional fields **clear** the stored value rather than leaving it alone.
- **Dispatch is fire-and-forget.** `runCommand` and `cancelExecution` return immediately with an `executionId`. The mutation does NOT wait for the agent and does NOT confirm delivery. The agent's actual outcome (status, exitCode, stdout, stderr) arrives via a separate result channel — not yet exposed to the FE; coming next as a WebSocket subscription or `execution(id)` query.
- **Cancel when agent is offline → dropped.** Transport is core NATS (live-only), no buffering. If the agent isn't connected at the moment cancel is published, the cancel is lost. The original execution will still produce its natural terminal frame whenever the agent next produces one.
- **`privilegeLevel` is required on `runCommand`.** No default — the FE must declare `USER` or `ADMIN` explicitly.
- **Conflict (`409`) cases:** `createScript` / `updateScript` reject duplicate `name` within the same tenant.
