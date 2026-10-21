# OpenFrame Event Jobs

Two scheduled jobs around the published events:

- the **backfill** writes the current state of every document of a published type to the outbox, so its compacted
  topic holds the latest event of each one;
- the **reconciliation** compares every copied field, such as the organization name on tickets, with its source, and
  reports the rows that differ. It repairs nothing; a new backfill run does.

They run in `openframe-saas-stream` only. They do nothing until you switch them on.

## How it works

```
@Scheduled tick (every 30 s)              scheduler/EventBackfillJob, scheduler/ReconciliationJob
   │  per type / per copy, under the ShedLock lock backfill:<type> / reconciliation:<copy>
   ▼
EventBackfillService / ReconciliationService     start a run, continue it, or wait
   │
   ▼
EventJobTicker                                   batches until DONE, half of lock-at-most-for, or shutdown
   │  one batch: EventBackfillRunner / ReconciliationRunner
   ▼
EventJobService ──> event_jobs                  one document per job: run id, status, lastId, counts
```

- One pod runs a job at a time: the lock is ShedLock's, with the stream's `LockProvider` (Redis). A dead pod's lock
  expires after `lock-at-most-for`, and the next tick on any pod continues from the saved `lastId`.
- [`EventJob`](src/main/java/com/openframe/event/jobs/persistence/EventJob.java#L21) holds the progress rules; each change returns a copy, and
  [`EventJobService`](src/main/java/com/openframe/event/jobs/service/EventJobService.java#L13) saves it. The document has `@Version`, so a pod still busy
  with an older copy fails its save and stops. `event_jobs` is read from the primary.
- [`EventJobTicker`](src/main/java/com/openframe/event/jobs/service/EventJobTicker.java#L17) runs both jobs' batches. It stops after the current batch when
  the service shuts down ([`EventJobShutdown`](src/main/java/com/openframe/event/jobs/service/EventJobShutdown.java#L7)): Spring does not interrupt a
  running `@Scheduled` task.
- `lastId` is saved only after a batch is written, so a crash repeats at most one batch. For the backfill that means
  the same events again, with the same versions, which consumers drop.
- One error, Mongo down included, skips only that type or copy for the tick, never the others.

## Configuration

```yaml
openframe:
  events:
    jobs:
      enabled: false                    # the whole module (default false); a change needs a pod restart
      backfill:                         # only with openframe.events.publishing.enabled: true
        runs:
          organizations: "2026-10-21"   # a run id per type; a new value starts the type again from its first document
        batch-size: 500
        pause: 200ms
        poll-interval: 30s
        lock-at-most-for: 2m            # a tick works for half of it
        max-failures: 3                 # errors in a row before the run is FAILED
      reconciliation:
        enabled: false                  # its own switch (default false); needs the module switch too
        cron: "0 0 3 * * *"             # UTC; when a new run is due. The first run starts at once
        batch-size: 1000
        pause: 200ms
        poll-interval: 30s
        lock-at-most-for: 2m
        max-failures: 3
        sample-size: 5                  # sample ids per ERROR line
```

The type keys are the `PublishedAggregateType` names; an unknown key stops the service.

The service that turns the module on also provides:

- `@EnableScheduling`; the module does not switch scheduling on for every service that adds it;
- a ShedLock `LockProvider` bean;
- for the backfill, `openframe.events.publishing.enabled: true` and `openframe.events.topics.<type>.publish: true`.
  Without publishing the module starts with reconciliation only, and logs a WARN when run ids are set. A type whose
  publish is off is skipped with a WARN, because the outbox write would do nothing;
- for the reconciliation, one [`ReconciledCopy`](src/main/java/com/openframe/event/jobs/reconciliation/ReconciledCopy.java#L11) bean per copied field,
  by document classes and property names.

In `openframe-saas-stream` all of these are in `EventJobsConfiguration`, with locks under the shared's own Redis
namespace, and two scheduler threads (`spring.task.scheduling.pool.size`).

## Backfill

**Start** a backfill of a type: set a run id for it under `backfill.runs`, then restart the stream. Any string works;
a date is easy to read. The log shows `Backfill of <type> started, run <id>`, then `done` at the end.

**Repeat** it: set a new run id and restart. The new run starts again from the first document. Leaving the same run id
changes nothing: a DONE run stays done. A run id once replaced is never started again, so pods that still have the old
config during a rolling restart leave the new run alone; always use a new value.

Each batch is written from the documents' current state, then their versions are read again from the primary. A
document written meanwhile is published once more, so its newest state is the last record on the compacted topic
([`republishChanged`](src/main/java/com/openframe/event/jobs/backfill/EventBackfillRunner.java#L56)).

**Follow** it in `event_jobs`, `_id: "backfill:<type>"`:

```javascript
db.event_jobs.findOne({_id: "backfill:organizations"})
// runId, status (RUNNING, DONE, FAILED), lastId, processed, failures, lastError, startedAt, updatedAt, finishedAt
```

and with the metric `openframe.events.backfill.documents{type}`.

**Errors:**

- Mongo down: the tick stops and the next one tries again. Nothing is counted.
- Any other error: counted in `failures`, with the message in `lastError`; the next tick tries again. After
  `max-failures` in a row the run is FAILED, with an ERROR line and the metric `openframe.events.backfill.failed{type}`
  (alert `event-backfill-failed`).
- After a fix, restart the stream: a pod that started after the run failed tries it once more, from its `lastId`
  ([`resumeFailed`](src/main/java/com/openframe/event/jobs/backfill/EventBackfillService.java#L54)). Pods that were already running leave it FAILED. A new
  run id starts from the beginning instead.

## Reconciliation

**Read** the result in the gauge `openframe.events.reconciliation.mismatches{copy}`: the rows that differed in the
last finished run. Every pod reports it from `event_jobs` on each tick, so the alert `event-reconciliation-drift` takes
`max by (namespace, copy)`. A run in progress does not change it.

A row counts as a mismatch when its copy differs from the expected value, or when its source document no longer
exists ([`mismatchOf`](src/main/java/com/openframe/event/jobs/reconciliation/ReconciliationRunner.java#L89)). A row without a reference (for example a
ticket with no `organizationId`) is skipped. Sources are matched by tenant and key (`organizations.organizationId`,
not `_id`), in one query per batch. A row that looks wrong is read again from the primary, with its source, before it
counts ([`confirm`](src/main/java/com/openframe/event/jobs/reconciliation/ReconciliationRunner.java#L110)), so a copy updated meanwhile is not drift.

A run that checked no rows logs a WARN, or an ERROR when the target collection does not exist: usually a wrong name in
the copy. When a tenant is removed, its rows may count as missing sources until its cleanup deletes them.

**Find** the rows in the ERROR lines of the stream, one per batch and tenant:

```
Reconciliation of tickets.organizationName in tenant <id>: 3 wrong copy(ies), for example [...]; 1 missing source(s), for example [...]
```

**Repair**: while the aspects write the copies, a mismatch is a missed aspect write; fix the aspect or the rows. Once
a processor writes the copy (stage 6), a new backfill run of the source type brings every copy up to date.

**Add a copy**: one `ReconciledCopy` bean in the stream, by document classes and property names:

```java
@Bean
public ReconciledCopy ticketOrganizationName() {
    return ReconciledCopy.builder()
            .name("tickets.organizationName")                       // the metric tag and the job id
            .targetClass(Ticket.class).targetReferenceProperty("organizationId").targetProperty("organizationName")
            .sourceClass(Organization.class).sourceKeyProperty("organizationId").sourceProperty("name")
            .build();                                               // .expectedCopy(...) when the copy is transformed
}
```

At startup [`ReconciledCopyMapper`](src/main/java/com/openframe/event/jobs/reconciliation/ReconciledCopyMapper.java#L14)
resolves the collections and the stored field names through Spring's mapping metadata (`@Document`, `@Field`). An
unknown property, or a document without `tenantId`, stops the service. Two copies with one name stop the service. From stage 6 the processors declare their copies instead.

**Errors** work as for the backfill, without the resume: a FAILED run waits, and the next cron run starts fresh. It
counts in `openframe.events.reconciliation.failed{copy}` (alert `event-reconciliation-failed`); the gauge keeps the
run before.

## Rebuild and replay

These are offset resets with the standard Kafka tools, not jobs of this module. See
[Replay](../openframe-event-processing/README.md#replay) in `openframe-event-processing`: reset a group
`--to-earliest` to re-apply a whole topic, or `--to-offset` from a DLT record's `kafka_dlt-original-offset` header.
Never copy a DLT record back to its topic.

## Tests

```bash
mvn test -pl openframe-event-jobs -am -Dintegration.tests=true -Dtest='**/event/jobs/**/*' -Dsurefire.failIfNoSpecifiedTests=false
```

The `*IT` classes start a Mongo container (Docker must run); without `-Dintegration.tests=true` they are skipped.
