# fleetmdm SDK

Java client for the Fleet REST API of OpenFrame's shared Fleet (the `flamingo-stack/fleetmdm`
fork). One Fleet server serves many tenants on one MySQL database; a tenant is a Fleet team, and
every request from this client is pinned to the caller's tenant by the `X-Tenant-Id` header
(`FleetTenantHeader`). Fleet then scopes a request to that team only where the fork has written a
fence for the datastore reads behind the endpoint. Everything else in Fleet still reads every
tenant's rows.

**This README is the list of Fleet endpoints OpenFrame server-side code may call.** A method is
added to `FleetMdmClient` only after every datastore read behind its endpoint has been checked,
and its row is added here in the same PR. An endpoint with no row is unverified: do not call it
from any OpenFrame module, script or tool. The browser plane has its own list, the
`allowed-endpoints` of the gateway configs (`openframe-saas-tenant` and `openframe-saas-shared`,
`configs/*/openframe-saas-gateway.yml`); that list does not protect this client, which reaches
Fleet directly.

## How to read the table

| Status | Meaning |
|---|---|
| `fenced` | Every tenant-data read behind the endpoint takes the team from the request pin. Callable. A foreign object answers as missing: 404, 204 with an empty body, or an empty page. |
| `partial` | Fenced except for a named parameter. Callable only without it; the Note says which. |
| `unfenced` | At least one read returns other tenants' rows. Not callable until the fork fences it and the Fleet image ships. |
| `global` | No tenant-owned rows behind it (instance users, in-memory data). Safe by nature, not by a fence. |
| `unpinned` | Fleet's tenant middleware skips the path (agent-plane marker in the path). Callable only while it holds no tenant data. |

Fence names are `fleet.Datastore` methods in `server/datastore/mysql/` of the fork, wrapped in
`// >>> OPENFRAME(mysql-multitenancy)` marker blocks. How fences work, what is deliberately
unfenced and why: `openframe/docs/mysql-multitenancy-feature.md` in the fork ("Datastore fences",
"Known deferred").

## FleetMdmClient

### Hosts

| Method | Fleet endpoint | Status | Fence | Note |
|---|---|---|---|---|
| `searchHosts` | `GET /api/v1/fleet/hosts` | fenced | `ListHosts` via `applyHostFilters`; `software_title_id` resolves `SoftwareTitleByID` within the pinned team and skips the unscoped name lookup | Sends `query`, `page`, `per_page`, `order_key`, `order_direction`, `software_title_id`. |
| `countHosts` | `GET /api/v1/fleet/hosts/count` | partial | `CountHosts` via `applyHostFilters` | With `label_id` the count comes from `CountHostsInLabel`, which is unfenced. The client never sends `label_id`; do not add it. |
| `getHostById` | `GET /api/v1/fleet/hosts/{id}?exclude_software=true` | fenced | `Host`; nested policies, labels, packs, MDM and lock-wipe reads keyed by the fenced host | Fleet recomputes `host_issues` for the raw id before the fence (a write, no read-back), then 404s for a foreign host. |
| `getHostVulnerabilityInventoryById` | `GET /api/v1/fleet/hosts/{id}` | fenced | as above, plus `LoadHostSoftware` keyed by the fenced host | |
| `listHostSoftware` | `GET /api/v1/fleet/hosts/{id}/software` | fenced | `HostLite` (404 for a foreign host); `ListHostSoftware` keyed by the fenced host | Installer and VPP availability joins use the host's own team. |
| `runQuery`, `runQueryAsync` | `POST /api/v1/fleet/hosts/{id}/query` | fenced | `HostLiteByID`; ad-hoc query re-homed to the pinned team by `NewQuery`; `HostIDsInTargets`, `CountHostsInTargets` | |

### Queries and live queries

| Method | Fleet endpoint | Status | Fence | Note |
|---|---|---|---|---|
| `listScheduledQueries` | `GET /api/v1/fleet/queries` | fenced | `ListQueries` (team forced to the pin, inherited rows off) | `include_openframe_managed=1` only toggles the fork's managed-query exclusion. |
| `getQueryById`, `getScheduledQuery` | `GET /api/v1/fleet/queries/{id}` | fenced | `Query` | |
| `createScheduledQuery` | `POST /api/v1/fleet/queries` | fenced | `NewQuery` re-homes the query to the pinned team; `LabelIDsByName` | A `team_id` in the payload is overwritten by the pin. |
| `updateScheduledQuery` | `PATCH /api/v1/fleet/queries/{id}` | fenced | `Query`; `SaveQuery` verifies the row on the primary | |
| `deleteScheduledQuery` | `DELETE /api/v1/fleet/queries/id/{id}` | fenced | `Query`; `DeleteQuery` under the query's own team | |
| `addQueryHosts`, `removeQueryHosts` | `POST` / `DELETE /api/v1/fleet/queries/{id}/hosts` | fenced | `Query`; `AddQueryHosts` / `RemoveQueryHosts` drop foreign host ids | Fork endpoints (host assignments). Foreign ids are dropped silently, not rejected. |
| `runLiveQueryAsync` | `POST /api/v1/fleet/queries/run` | fenced | `Query` / `NewQuery`; `HostIDsInTargets`, `CountHostsInTargets`; campaign rows carry the tenant through the re-homed query | |

### Policies

| Method | Fleet endpoint | Status | Fence | Note |
|---|---|---|---|---|
| `listPolicies`, `listPoliciesAsync` | `GET /api/v1/fleet/global/policies` | fenced | `ListGlobalPolicies` (nil team resolves to the pin) | |
| `getPolicyById`, `getPolicy`, `getPolicyAsync` | `GET /api/v1/fleet/global/policies/{id}` | fenced | `Policy` | |
| `createPolicy`, `createPolicyAsync` | `POST /api/v1/fleet/global/policies` | fenced | `NewGlobalPolicy` re-homes to the pinned team; `LabelIDsByName` | The created policy carries the tenant's `team_id`, not null. |
| `updatePolicy`, `updatePolicyAsync` | `PATCH /api/v1/fleet/global/policies/{id}` | fenced | `Policy`; `SavePolicy` verifies on the primary | |
| `deletePolicyAsync` | `POST /api/latest/fleet/policies/delete` | fenced | `PoliciesByID`; `DeleteGlobalPolicies` filters foreign ids | |
| `addPolicyHostsAsync`, `removePolicyHostsAsync` | `POST` / `DELETE /api/v1/fleet/policies/{id}/hosts` | fenced | `Policy`; `AddPolicyHosts` / `RemovePolicyHosts` drop foreign host ids | Fork endpoints (host assignments). |

### Software and vulnerabilities

| Method | Fleet endpoint | Status | Fence | Note |
|---|---|---|---|---|
| `listSoftwareTitles` | `GET /api/latest/fleet/software/titles` | fenced | `ListSoftwareTitles` with the pinned team, including the version and CVE match of `query` and `vulnerable` | `team_id`, `min_cvss`, `max_cvss`, `exploit` are Premium-gated in Fleet; the pin applies regardless. |
| `getSoftwareTitle` | `GET /api/latest/fleet/software/titles/{id}` | fenced | `SoftwareTitleByID`, including Fleet's "as global admin" fallback | |
| `getSoftwareVersion` | `GET /api/latest/fleet/software/versions/{id}` | **unfenced** | none: the service `SoftwareByID` has no fence; the global-admin role filter selects the instance-wide host-count rows, and a NotFound falls back to a name stub from a global-admin lookup | **Called today** by api-lib `SoftwareInventoryService.cveDetails` (method reference `fleet()::getSoftwareVersion`), behind `openframe.rmm.software.fleet-paging.enabled` (true in every environment, prod included), with version ids taken from the tenant's own fenced `getSoftwareTitle` response and reading only `vulnerabilities` (catalogue data). No cross-tenant rows reach a tenant through that path today, but the endpoint answers any id in the instance, so **no new caller** until the fork fences it the way the hosts list resolves `software_version_id` within the pinned team and skips the fallback. The fence keeps this caller working: a version on the tenant's hosts has a per-team count row; a version installed since the last hourly recount may 404 until the next run, which the caller tolerates. |
| `listVulnerabilities` | `GET /api/latest/fleet/vulnerabilities` | fenced | `ListVulnerabilities`, `CountVulnerabilities` with the pinned team | An empty page reports the instance's last host-count recalculation time, not `now()`. |
| `getVulnerability` | `GET /api/latest/fleet/vulnerabilities/{cve}` | fenced | `Vulnerability`, `OSVersionsByCVE`, `SoftwareByCVE` with the pinned team | |

### Enrollment and schema

| Method | Fleet endpoint | Status | Fence | Note |
|---|---|---|---|---|
| `getEnrollSecret` | `GET /api/latest/fleet/spec/enroll_secret` | fenced | `GetEnrollSecrets` forced to the pinned team | |
| `searchOsquerySchema` | `GET /api/v1/fleet/osquery/schema/search` | unpinned, global | none: in-memory osquery schema, no datastore | The path contains `/osquery/`, so Fleet's tenant middleware skips it. Safe while it holds no tenant data. |

## FleetMdmSetupClient

Used once per tenant by management to create the tenant's Fleet API user. These endpoints touch
instance-wide users and sessions, not tenant rows.

| Method | Fleet endpoint | Status | Note |
|---|---|---|---|
| `setup` | `POST /api/v1/setup` | global | Mounted by Fleet only while initial setup is required; runs outside the tenant middleware. |
| `login` | `POST /api/v1/fleet/login` | global | Users are instance-wide. |
| `createApiOnlyUser` | `POST /api/v1/fleet/users/admin` | global | Send `global_role` only. A `teams` payload is validated against every tenant's team list; never send one. |

## Adding a method

1. Find the endpoint's handler in `server/service/` of the fork and list every `fleet.Datastore`
   method it reaches: the main query, the count statement, any second "details" or "versions"
   query, any fallback or "as global admin" lookup.
2. For each, confirm a `mysql-multitenancy` marker block inside the function (or inside the
   private helper it builds its query with, such as `applyHostFilters`) that takes the team from
   the context. `git grep -n "OPENFRAME(mysql-multitenancy)" -- server/datastore/mysql/<file>.go`.
   The fork's feature doc lists the fenced functions and the deliberate exceptions.
3. All fenced: add the method, handle 404 / 204 / empty page for another tenant's object, and
   add the row above in the same PR.
4. Anything unfenced: stop. The fence lands in the fork first and ships in the Fleet image; the
   SDK method follows. When checking whether a method is used, search for method references
   (`::methodName`) as well as calls. A function that crons or vulnerability processing also call must not be
   fenced itself; the request-path caller is scoped instead.
5. Never work around a 404 or an empty page with a second lookup as a different user: that is the
   fallback the fences exist to prevent.

A sync of the fork from upstream can move a query out from under its marker. After each sync,
re-check every row of this table against the fork before bumping the Fleet image.

## Tenant header

`FleetMdmClient(baseUrl, apiToken, tenantId)` sends `X-Tenant-Id: <tenantId>` on every request.
With multi-tenancy enabled, Fleet rejects a request without it (401 `missing tenant`) and
creates a team for an unknown UUID, so the id must be the platform tenant UUID and must come from
configuration (`TENANT_ID`), never from user input. `FleetTenantHeader.validate` fails at startup
when the flag is on and the id is blank.
