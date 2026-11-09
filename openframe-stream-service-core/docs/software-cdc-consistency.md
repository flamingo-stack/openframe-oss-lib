# Software CDC projection — consistency design

Reference for the Fleet `host_software` → Mongo read-model pipeline (software inventory and
vulnerabilities). Describes what the current code guarantees, how, and where the open risks are.
Grounded in `main` (November 2026) plus steps 1–2 of section 7.1; line numbers are approximate.

Status: **living reference, reconstructed from the code.** The earlier verbal/notes design
(attributed to A. Yakovenko) is not in the hub and its author has left; this document is the
source of truth and should be edited in place as the pipeline evolves.

---

## 1. Scope and the pipeline

Fleet is the system of record for installed software and the CVEs attached to it. The UI needs
tenant-wide, sortable, paginated lists (software, vulnerabilities, per-device views) that Fleet's
API cannot serve efficiently at scale. We keep denormalized Mongo read models and feed them from
Fleet by CDC.

```
Fleet MySQL                Debezium → Kafka            openframe-stream-service
  host_software  ──CDC──▶  row change events  ──────▶  DeviceSoftwareHandler
                                                              │  (event = trigger only)
                                                              │  re-reads host's CURRENT
                                                              │  software from Fleet API
                                                              ▼
                                                   device_software  (Mongo, source-of-truth copy)
                                                              │
                                              ┌───────────────┴───────────────┐
                                              ▼                               ▼
                                     SoftwareProjector              VulnerabilityProjector
                                              ▼                               ▼
                                     software (read model)          vulnerabilities (read model)
                                              └───────────────┬───────────────┘
                                                              ▼
                                         API (behind openframe.features.software-read-model.enabled)
```

Gates:
- `openframe.fleet.software-cdc.enabled` — turns the stream handler on (`DeviceSoftwareHandler`).
- `openframe.features.software-read-model.enabled` — switches the API read path from Fleet to the
  read models (`SoftwareInventoryService`, `VulnerabilityInventoryService`).

Both are off until Debezium captures `host_software` and the models are backfilled.

## 2. Collections, keys, indexes

### `device_software` — the derived source of truth (one row per device × software title)
`DeviceSoftware.java`
- unique `tenant_machine_title {tenantId, machineId, softwareTitleId}` — the natural key; every
  upsert/read of a single row goes through it.
- `tenant_machine {tenantId, machineId}` — the reconcile's "all titles on this host" read.
- `tenant_title_connected {tenantId, softwareTitleId, machineConnected, machineId}` — the software projector's aggregation,
  "connected devices with this title" (`machineId` backs its sort); the leading keys also serve queries
  without `machineConnected`.
- `tenant_vuln_connected {tenantId, vulnerabilities, machineConnected, machineId}` — multikey; the vulnerability projector's
  aggregation, "connected devices with this CVE".

Fields carried from Fleet: `name`, `versions[]`, `vulnerabilities[]` (CVE ids), `source`, `updatedAt`.

### `software` — read model (one row per tenant × software title)
`Software.java` · unique `tenant_title {tenantId, softwareTitleId}`, plus
`tenant_name {tenantId, nameLower}`, **`tenant_devices {tenantId, devicesCount:-1}`**,
`tenant_cveCount {tenantId, cveCount:-1}`, `installations_machine {tenantId, installations.machineId}`.
Stored denormalized: `devicesCount`, `cveCount`, `latestVersion`, `installations[]`.

### `vulnerabilities` — read model (one row per tenant × CVE)
`Vulnerability.java` · unique `tenant_cve {tenantId, cveId}`, plus
**`tenant_devices {tenantId, devicesCount:-1}`**, `tenant_discovered {tenantId, discoveredAt:-1}`,
`tenant_title {tenantId, affectedSoftware.softwareTitleId}`.
Stored denormalized: `devicesCount`, `affectedSoftware[]` (each with its own `devicesCount`).
The former `machineIds[]` list was removed in #2956 — affected devices are derived at read time
from `device_software`; only the `devicesCount` number stays denormalized.

## 3. Core principle: event-as-trigger + recompute-from-source

`DeviceSoftwareHandler.handle` (`DeviceSoftwareHandler.java:52`) deliberately uses the Debezium
payload for **one thing only**: the `host_id` (from `before` on delete, `after` otherwise, line 58).
It does **not** apply the row's columns. It then:

1. Resolves the host → tenant/machine (`FleetHostResolver`), skipping unresolved hosts (line 67).
2. Re-reads the host's **entire current** software list from the Fleet API
   (`FleetHostSoftwareCache.hostSoftware`, line 88) — Fleet is the source of truth.
3. Reconciles `device_software` for that host (`reconcile`, line 87): upsert every present title,
   delete every row no longer present (lines 102–130).
4. Hands the titles and CVEs it touched to `SoftwareProjectionTrigger` (`titlesChanged`, `cvesChanged`),
   which recomputes the read models for exactly those. `DeletedMachineCleanup` and
   `DeviceSoftwareConnectivitySync` go through the same entry point; it also records the
   `openframe.software.projection` metrics.

Both projectors **recompute from scratch**, never delta, and they compute inside Mongo
(`DeviceSoftwareAggregationRepository`) without loading the rows into memory:
- `SoftwareProjector.project` takes `rollUpTitle`: one aggregation over the title's connected rows yields
  `devicesCount` (a row is unique per machine × title, so no distinct is needed), `cveCount`, and the unions of
  versions and Windows program keys. Java picks `latestVersion` with `SoftwareVersions::compare` (numeric per
  segment) from the small set of versions. While `installations[]` stays on `Software` (step 4 of section 7.1),
  the aggregation returns it too. No rows → the read-model row is deleted.
- `VulnerabilityProjector.project` takes `rollUpCve`: an aggregation over the connected rows carrying the CVE
  groups by title and counts `devicesCount` as **distinct** machines — one machine can carry the CVE through two
  titles. No rows → delete.

### Why this shape
It makes the whole pipeline **idempotent** and **self-healing**: because every event throws away the
payload and re-derives the host's state from Fleet, a duplicated, reordered or replayed event
produces the same result as processing it once. This is the deliberate answer to Kafka
at-least-once delivery — correctness does not depend on seeing each event exactly once or in order.

## 4. Consistency properties the code actually provides

| Property | How | Where |
|---|---|---|
| **Idempotent under at-least-once** | event carries no state; host is fully re-derived from Fleet | `DeviceSoftwareHandler.java:58,88` |
| **Self-healing** | any event for a host rebuilds that host's full `device_software` set | `reconcile` lines 102–130 |
| **Read dedup within a Fleet commit** | cache keyed `tenant:host:commitTs`; a burst of row events from one commit fetches Fleet once | `FleetHostSoftwareCache.java:34-35`, `DeviceSoftwareHandler.java:78-85` |
| **No stale list across commits** | a later commit's `commitTs` is a new cache key, so it never serves a list fetched for an earlier commit | same |
| **Counters indexed for the UI** | `devicesCount` stored and indexed (`tenant_devices`) so sort/filter/paginate run in Mongo, not in memory | `Software.java`, `Vulnerability.java` |

## 5. Kirill's 7 points — claim vs. code

1. **Counter denormalized for sorting** — ✅ `devicesCount` stored + `tenant_devices {…, devicesCount:-1}` on both read models.
2. **Two collections (devices / vulns)** — ✅ `device_software` (truth) feeds `software` and `vulnerabilities`.
3. **Archived device excluded from the counter** — ✅ **resolved** (was a gap). Device deletion now
   drops the device's `device_software` rows and re-projects the affected titles/CVEs, so the counters
   fall by that device. See G3.
4. **Ideal consistency under Kafka at-least-once** — ✅ achieved, but via **idempotent
   recompute-from-source**, not a counter trick. Dup/replay/reorder all converge.
5. **Races solved via version** — ❌ **no `@Version`, no optimistic lock, no transaction.** Safety
   comes from recompute + the `commitTs` read key, which orders the *read*, not the *write*. See G1.
6. **Large data → batches** — ❌ **no batching.** `reconcile` does per-title `find`+`save` in a loop;
   each affected CVE triggers a projector that reloads the full device cohort. See G2, G4.
7. **Most-efficient counter / avoid recompute** — ⚠️ the code does the **opposite**: it always
   recomputes. Justified by point 4, but the cost is real and concentrated in the CVE projector (G2).

(Kirill's earlier list had an 8th point — "all consistency approaches from Yakovenko's design" — which
he dropped on edit; that design is not in the hub and the author has left, and this document replaces
it as the reference. See the header.)

Points **4 and 7 are in direct tension**, and the code resolves it in favour of 4 (correctness).
The honest framing for the team: we chose *always-correct, recompute-on-every-event* over
*cheap-but-fragile delta counters*. Delta increments would double-count under at-least-once redelivery.

## 6. Known gaps and risks

### G1 — Write races on the same host (no version, no transaction)
`reconcile` is a read-modify-write sequence of independent Mongo ops (`find existing` → N× `save` →
M× `delete`), with no transaction and no optimistic version. If two events for the **same host** are
processed concurrently (possible unless the consumer serialises per host — **verify partitioning**),
they can interleave: both read the old existing set, both upsert, and one's "delete absent" can
remove a row the other just wrote, or leave an orphan. The `commitTs` cache only dedups the Fleet
read; it does not serialise the writes.
Impact: transient wrong `devicesCount`, or a lingering/missing `device_software` row until the next
event for that host self-heals it.
**Verified 2026-11-09:** today stream processes events in sequence (1 replica × 1 thread), so G1 does not
happen. But the partition key is `(host_id, software_id)`, not `host_id`, so G1 becomes real once
concurrency or replicas go up. Details: section 7.1, "Will `devicesCount` be consistent".
Options: (a) serialise processing per `host_id` (partition the Debezium topic by host, or a per-host
lock/queue in the consumer); (b) add `@Version` to `device_software` and retry on conflict;
(c) accept it, because the next event for the host converges — document the eventual-consistency window.

### G2 — CVE projector fan-out (the real scaling concern)
**Status:** steps 1–2 of section 7.1 are done: rows are no longer loaded into memory. The recount on every
event remains (until step 5), and the `installations[]` array is still rewritten (until step 4). The text below is the state before step 2.

`VulnerabilityProjector.project` calls `findByTenantIdAndVulnerabilitiesContaining(tenant, cve)` —
**every** device that has that CVE — on **every** host event that touches the CVE. For a CVE present
on N devices, one host's change costs an O(N) reload + recompute. A popular CVE (e.g. a libc/openssl
on thousands of endpoints) means every single host event re-reads thousands of rows.
**The software projector has the same problem.** The host's title list decides which titles to
re-project, but `SoftwareProjector.project` loads every row of the title across the tenant
(`findByTenantIdAndSoftwareTitleIdAndMachineConnectedTrue`) and rewrites the whole `installations[]`
array. A Chrome update on N machines is N events × N rows: O(N²) reads and N writes of an N-element array.
The chosen path is section 7.1. Options considered: (a) debounce/coalesce per `(tenant, cve)` over a short window and recompute once;
(b) move projection off the handler thread onto an async worker keyed by `(tenant, cve)` with
collapsing; (c) incremental counter maintenance for the CVE `devicesCount` guarded by a version
(gives up some of the recompute simplicity — weigh against G1/point 4);
(d) cap/measure expected cohort sizes first (see Open questions).

### G3 — Archived / offboarded devices inflate counters — ✅ RESOLVED
**The problem (was):** the counter is `distinct(machineId)` across `device_software`. A device drops
out only when a Fleet `host_software` event for it triggers a reconcile that finds it gone. A device
that is deleted/offboarded stops producing Fleet events, so its `device_software` rows would linger
and keep inflating every `devicesCount` they feed — the single most likely "counter looks too high"
bug in production.

**The fix (option a):** device deletion is the signal. Both offboarding paths — `DeviceService`
(status → `DELETED`) and `AgentUninstallService` (agent uninstall) — already call
`DeletedMachineCleanup`; that component now, besides clearing schedules, removes the device's
`device_software` rows (`deleteByTenantIdAndMachineId`) and re-projects every software title and CVE
the device touched, so the denormalized counts fall by exactly that device (a title/CVE that lived
only on it is deleted from the read model). To make this reachable from the deletion deployables, the
two projectors moved from `openframe-stream-service-core` to `openframe-data-mongo-sync`
(`com.openframe.data.service.rmm.software`) — their natural home, since they depend only on
repositories.
See `DeletedMachineCleanup.cleanUpDeletedMachine` / `removeFromSoftwareReadModel`.

**Still open:** `DeviceStatus.ARCHIVED` is never set on a machine today (every offboarding uses
`DELETED`), so there is no separate archive path to hook. If one is ever added, it must call the same
cleanup. A permanently silent host that is *not* deleted is still G6.

### G4 — No batching / N+1 writes
`reconcile` issues one `find` + one `save` per title and one `delete` per removed title; each
projector does its own `find` + `save`. For a host with hundreds of titles this is hundreds of round
trips. `BulkOperations` (upsert many, delete many) would cut this sharply. Low correctness risk,
real latency/throughput cost at scale.

### G5 — Event-time vs wall-clock
`discoveredAt` and `updatedAt` are set with `Instant.now()` at processing time
(`VulnerabilityProjector.java:54,56`, `SoftwareProjector.java:59`), not from the Fleet/CDC commit
time. Replays or backfills will stamp "now", so these fields are processing markers, not source
timestamps. Acceptable today; note it before anyone sorts/filters on `discoveredAt` as if it were the
true discovery time.

### G6 — Cross-host counters assume every host stays current
A tenant-wide count is only as correct as the union of all its hosts' `device_software`. A host that
goes permanently silent (crashed agent, lost enrolment) without a delete event (see G3) skews every
counter it contributes to, indefinitely.

## 7. Recommendations (ranked)

1. ~~**Close G3 first** — wire device delete/archive to `deleteByTenantIdAndMachineId` + re-project.~~
   ✅ **Done** — see G3. Device deletion now cascades the `device_software` cleanup and re-projects.
2. **Decide G1 explicitly** — either serialise per host (cleanest, also de-risks G2) or write down
   that the system is eventually consistent per host and the window is "until the next event".
   Do not leave point 5 ("solved via version") in the team's mental model unchallenged — it is not
   what the code does.
3. **Address G2 before enabling the flag at scale** — migration plan in section 7.1: now a single entry
   point with metrics, recount in Mongo and dropping `installations[]`; coalescing is conditional (step 5).
   No incremental deltas, so point 4's idempotency survives.
4. **G4 batching** — a mechanical win once the above are settled.

## 7.1. G2 migration plan

### Target shape

```
reconcile(host) ──► device_software (upsert/delete)
        │
        └──► dirty{tenantId, kind, key}  (upsert: 1000 Chrome events = 1 row)
                         │
                         ▼  flusher: @Scheduled + @SchedulerLock, every flush-interval
              recount from device_software inside Mongo (count / aggregation)
                         │
            ┌────────────┴─────────────┐
            ▼                          ▼
   software (thin):              vulnerabilities:
   metadata, latestVersion,      devicesCount, affectedSoftware[]
   devicesCount, cveCount        (one entry per title, not per machine)
   — no installations[]

reads: lists   → software / vulnerabilities (sorted on the tenant_devices index)
       details → device_software directly (devices of a title, software and CVEs of a device)
```

Unchanged: the event is only a trigger, host state is re-read from Fleet, and the read model is
always recomputed from `device_software`, never maintained by deltas (point 4, section 3).

The diagram above is the end state. Coalescing (`dirty` + flusher) is switched on under the condition in
step 5; until then the projectors run immediately, but already through the single entry point from step 1.

### Tenant sizes (2026-11-09)

The five largest tenants by active devices: **242, 231, 214, 141, 107**. For a Chrome update in the
largest tenant that is:

| | today | after steps 2–4 | + coalescing (step 5) |
|---|---|---|---|
| software, whole rollout | 242 × 242 ≈ 58k rows into memory + 242 rewrites of a 242-element array | ≈ 58k index entries inside Mongo, the write is a few fields | a few recounts |
| CVE (an event touches ~50 CVEs) | ≈ 3M rows into memory | ≈ 3M index entries in Mongo, no data transferred | orders of magnitude less |

Work grows as N². At N ≈ 250 steps 2–4 remove the main cost (rows in memory and array rewrites), and
coalescing adds little. At N ≈ 2,000 it is already ~4M index entries per title per rollout and hundreds
of millions on the CVE side. Then stream falls behind on mass updates without coalescing.

### Steps (one oss-lib PR each, while both flags stay off on stage/prod)

**Step 1. Single entry point and metrics (no behaviour change).** ✅ Done.
- `SoftwareProjectionTrigger` with `titlesChanged(tenantId, titleIds)` and `cvesChanged(tenantId, cveIds)`.
  `DeviceSoftwareHandler.reconcile`, `DeletedMachineCleanup` and `DeviceSoftwareConnectivitySync` call it
  instead of calling the projectors directly. For now the implementation calls the projectors right away;
  step 5's coalescing replaces only that implementation.
- A Micrometer timer per recount tagged `kind = title | cve` and a distribution of rows per recount.
  Names start with `openframe.`, otherwise the Alloy allowlist (`openframe_.*`) drops the metric.

**Step 2. Recount inside Mongo, no rows loaded into memory.** ✅ Done.
- `SoftwareProjector`: one aggregation per title — `$match {tenantId, softwareTitleId, machineConnected: true}`
  → `$group` with a `count` (a row is unique per machine×title, so no distinct is needed), `$addToSet`
  of versions, `installerTypes` and CVEs (after `$unwind`), `$first` for the name/program sample fields.
  The result is one small document; Java still picks `latestVersion` (`SoftwareVersions::compare`)
  from the small set of versions.
- `VulnerabilityProjector`: aggregation `$match {tenantId, vulnerabilities: cve, machineConnected: true}` →
  `$group` by title (`$addToSet machineId` for the per-title `devicesCount`) and a separate `$group` by
  `machineId` for the overall `devicesCount`. **Distinct is required here:** one machine can carry the
  same CVE through two titles, and a flat `countDocuments` would count it twice.
- Indexes: `{tenantId, softwareTitleId, machineConnected}` replaces `tenant_title` (covers both the count
  and the detail reads); `{tenantId, vulnerabilities, machineConnected}` replaces `tenant_vuln`.

**Step 3. Move detail reads to `device_software`** (behind the off
`openframe.features.software-read-model.enabled` flag, so no risk):
- `DeviceSoftwareReadModelQuery` (software of a device): `device_software` by `{tenantId, machineId}` +
  metadata from `software` by the list of `softwareTitleId`;
- `TenantSoftwareReadModelQuery` (devices of a title, two places): `device_software` by
  `{tenantId, softwareTitleId, machineConnected: true}`, paged in Mongo;
- `DeviceVulnerabilityReadModelQuery` (CVEs of a device): `device_software` by `{tenantId, machineId}`,
  unwind `vulnerabilities`.

**Step 4. Drop `installations[]` from `Software`** and the `installations_machine` index.
No data migration: `save` rewrites the whole document, so the old field disappears on the next recount
or backfill. Dropping the index is a manual database command a person runs.

**Step 5. Coalescing (debounce) — conditional.** Do it when any of these holds:
- the largest tenant approaches ~1,000 active devices;
- the step 1 metric shows recount time or consumer lag growing on mass updates;
- **always before** raising `spring.saas.kafka.listener.concurrency` or the number of stream replicas
  (section "Will `devicesCount` be consistent").

How:
- New collection `software_projection_dirty`: `{tenantId, kind: TITLE | CVE, key, dirtyAt}`,
  unique index `{tenantId, kind, key}`. The `SoftwareProjectionTrigger` implementation upserts markers
  instead of calling the projectors.
- Order in `reconcile`: mark **before** writing `device_software` and **after** it (two cheap
  idempotent upserts). The "before" marker survives a crash between the write and the marker: a
  redelivered event finds an empty diff and would mark nothing. The "after" marker stops the flusher
  from recounting between the marker and the write and clearing it with the old state.
- Flusher in stream (behind the same `openframe.fleet.software-cdc.enabled` flag): `@Scheduled` +
  `@SchedulerLock`, takes a batch of markers, and for each one reads `dirtyAt` → deletes the marker
  only if `dirtyAt` is unchanged → recomputes from the source. If an event re-marks the key, the delete
  misses or the marker comes back, and the next window recounts it.
- Config with no defaults, values only in `configs/dev/openframe-saas-stream.yml` (saas-shared):
  `flush-interval`, `batch-size`, `lock-at-most-for`.
- Effect: a Chrome update on 1000 machines is 1000 `device_software` writes (unavoidable) and one
  Chrome recount per window instead of 1000. Cost drops from N×N to (number of windows)×N.
- While the writer is off, markers from device deletions in api pile up. There are never more of them
  than the tenant's titles and CVEs, and the flusher drains them once enabled.

**Step 6. Safety net.** A periodic pass (e.g. daily, interval from config) that recounts every title and
CVE of the tenant (after step 5 it marks them dirty instead). It realigns anything that drifted (G1, a
lost marker, the race with api, a manual database edit).

**Step 7 (optional). G4** — `BulkOperations` in `reconcile`.

### Will `devicesCount` be consistent

Not instantly: it is **eventually consistent with a bounded window**. There are two separate levels:

| Level | Guarantee | What can break it | Covered by |
|---|---|---|---|
| `devicesCount` ↔ `device_software` | equals the row count as of the last recount; after step 5 it lags by at most one flush window | a lost marker; two concurrent recounts of the same title (stream and api) | the daily pass (step 6); after step 5, the double marker and a single flusher under `@SchedulerLock` |
| `device_software` ↔ Fleet | converges with the host's next event | G1 (concurrent events of one host), G6 (host goes silent without deletion), a failed Fleet read, hosts without backfill | G1 — section 6; G6 and backfill stay open and do not depend on this plan |

**What actually happens with concurrency today** (verified 2026-11-09 on saas-shared `origin/main`):
- `SharedFleetKafkaListener` consumes all four Fleet topics through `saasTenantKafkaListenerContainerFactory`.
  `spring.saas.kafka.listener.concurrency` is not set in any environment, so it is one consumer thread.
- The `openframe-saas-stream` deployment has `replicas: 1` and no HPA; the handler processes synchronously.
- So today stream processes every Fleet event strictly in sequence: neither G1 nor concurrent recounts of
  the same title happen on the stream side.

But that is an accident of configuration, not a guarantee:
- The topics have 3 partitions, and the Debezium message key is the `host_software` primary key,
  `(host_id, software_id)`, not `host_id`. One host's events spread across partitions. Raise the
  concurrency or the stream replica count and G1 and the recount race become real.
- Concurrent writes are already possible from other services. `DeletedMachineCleanup` and
  `DeviceSoftwareConnectivitySync` run from api-lib (api, external-api, client) and recount the same
  `software` / `vulnerabilities` while stream does too. `save` is last-writer-wins, so when they coincide
  a counter can stay wrong until the title's next event. Rare (only deletion and archive), but real; the
  daily pass (step 6) covers it.

After step 5 only the flusher writes `software` / `vulnerabilities`, and every recount runs after the
latest marker, so both problems go away. That is why step 5 is mandatory before any increase of stream
concurrency or replicas.

On machine status: `machineConnected` already lives in every row and is updated by one `updateMany` per
machine. `DeviceStatus.CONNECTED = {ONLINE, OFFLINE}`, so online↔offline does not trigger re-projection —
only archive, decommission or deletion does. Do not put online status into `device_software` rows: every
flap would recount hundreds of the machine's titles and CVEs. Filter "online only" at read time.

## 8. Open questions / verification

- ✅ **Kafka partitioning & consumer concurrency** (verified 2026-11-09): key is `(host_id, software_id)`,
  3 partitions; stream is 1 replica, concurrency not set (1 thread). Sequential today; see section 7.1.
- ✅ **Expected cohort sizes** (2026-11-09): the largest tenants have 242, 231, 214, 141, 107 active devices.
  Coalescing is not needed yet; the condition to switch it on is section 7.1, step 5.
- **Offboarding signal**: what event (if any) OpenFrame already has on device archive/delete that
  the pipeline can hook for G3.
- **Backfill**: initial load of `device_software` for existing hosts before the flag flips — not
  covered by the event path.

## 9. Code map

| Concern | File |
|---|---|
| Event handler / reconcile | `openframe-stream-service-core/.../handler/software/DeviceSoftwareHandler.java` |
| Fleet re-read + commit-ts cache | `.../handler/software/FleetHostSoftwareCache.java` |
| Host → tenant/machine resolve | `.../handler/software/FleetHostResolver.java` |
| Debezium field helpers | `.../handler/software/FleetRowFields.java` |
| Software read-model projector | `openframe-data-mongo-sync/.../service/rmm/software/SoftwareProjector.java` |
| Vulnerability read-model projector | `openframe-data-mongo-sync/.../service/rmm/software/VulnerabilityProjector.java` |
| Projector entry point + metrics | `openframe-data-mongo-sync/.../service/rmm/software/SoftwareProjectionTrigger.java` |
| Projector aggregations | `openframe-data-mongo-sync/.../repository/rmm/software/DeviceSoftwareAggregationRepositoryImpl.java` |
| Deleted-machine cleanup (G3) | `openframe-data-mongo-sync/.../service/rmm/DeletedMachineCleanup.java` |
| Documents / indexes | `openframe-data-mongo-common/.../document/rmm/software/{DeviceSoftware,Software,Vulnerability}.java` |
| Repositories | `openframe-data-mongo-sync/.../repository/rmm/software/{DeviceSoftware,Software,Vulnerability}Repository.java` |
| API read path (flagged) | `openframe-api-lib/.../service/rmm/software/SoftwareInventoryService.java`, `.../vulnerability/VulnerabilityInventoryService.java` |
