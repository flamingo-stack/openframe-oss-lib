# OpenFrame Event Jobs

Three scheduled jobs around the published events:

- the **backfill** writes the current state of every document of a published type to the outbox, so its compacted
  topic holds the latest event of each one;
- the **reconciliation** asks every projection of a type switched on, such as the organization name on tickets,
  which of its projected items differ from their source, reports them, and publishes those sources again to repair them;
- the **projection tasks** apply the large updates of a projection, for example a new organization name on 50,000
  tickets, in batches instead of inside one Kafka record. One document per run in `event_projection_tasks`, with at most
  one current run per projection, tenant and source document; a newer event of that source closes the current run and opens a
  new one from the first item.

They run in `openframe-saas-stream` only. They do nothing until you switch them on.

## How it works

```
@Scheduled tick (every 30 s)              scheduler/EventBackfillJob, scheduler/ReconciliationJob
   │  per type / per projection, under the ShedLock lock backfill:<type> / reconciliation:<projection>
   ▼
EventBackfillService / ReconciliationService     start a run, continue it, or wait
   │
   ▼
EventJobTicker                                   batches until DONE, half of lock-at-most-for, or shutdown
   │  one batch: EventBackfillRunner / ReconciliationRunner
   ▼
EventJobService ──> event_job_runs              one document per run: run id, status, lastId, counts
```

- One pod runs a job at a time: the lock is ShedLock's, with the stream's `LockProvider` (Redis). A dead pod's lock
  expires after `lock-at-most-for`, and the next tick on any pod continues from the saved `lastId`.
- [`EventJob`](src/main/java/com/openframe/event/jobs/core/persistence/EventJob.java#L21) holds the progress rules; each change returns a copy, and
  [`EventJobService`](src/main/java/com/openframe/event/jobs/core/service/EventJobService.java#L13) saves it. Each run is its own document, `_id: "<job>:<run id>"`;
  the job's current run is its newest by `startedAt`. A new run ends a RUNNING one as REPLACED, and the documents have
  `@Version`, so a pod still busy with an older copy fails its save and stops. `event_job_runs` is read from the primary.
- Finished runs stay for good, as the jobs' history; they are small, and reconciliation adds one per projection a night.
  [`EventJobRunIndexInitializer`](src/main/java/com/openframe/event/jobs/core/persistence/EventJobRunIndexInitializer.java) creates the `{jobId, startedAt}` index that finds the current run.
- [`EventJobTicker`](src/main/java/com/openframe/event/jobs/core/service/EventJobTicker.java#L17) runs both jobs' batches. It stops after the current batch when
  the service shuts down ([`EventJobShutdown`](src/main/java/com/openframe/event/jobs/core/service/EventJobShutdown.java#L7)): Spring does not interrupt a
  running `@Scheduled` task.
- `lastId` is saved only after a batch is written, so a crash repeats at most one batch. For the backfill that means
  the same events again, with the same versions, which consumers drop.
- One error, Mongo down included, skips only that type or projection for the tick, never the others.

### Projection tasks

- Every tick lists the RUNNING runs and works each under its own lock `projection-task:<run id>`, so several pods
  share them. Under the lock the task is read again, then `EventJobTicker` runs its batches: the projection's
  `applyBatch` after the saved `lastId`, until it returns `null`.
- [`ProjectionTask`](src/main/java/com/openframe/event/jobs/task/persistence/ProjectionTask.java#L22) is one run, `_id: "<key>:<event version>:<started ms>"`, with
  `key` = `<projection>:<tenantId>:<sourceId>` and `current` while RUNNING or FAILED. A newer event closes the current run (a
  RUNNING one ends REPLACED, a FAILED one stays FAILED) and inserts a new one; a unique index on `key` among current runs
  ([`ProjectionTaskIndexInitializer`](src/main/java/com/openframe/event/jobs/task/persistence/ProjectionTaskIndexInitializer.java)) allows only one. The runs have `@Version`, so a worker busy
  with the closed run fails its next save and stops; the next tick works the new run.
- A finished run is kept DONE, as the tasks' history; runs are never deleted.
- The task keeps the event's envelope as the outbox payload and reads it back into the spec's event class.
- `maxFailures` in a row set the run FAILED. It stays current, so the events of its source still go to the tasks; the next
  one opens a new run.
- Metrics, per `projection`: `openframe.events.projection.tasks.open` and `...oldest.age` (seconds since the oldest
  RUNNING task started), and the counter `openframe.events.projection.tasks.failed`.

## Configuration

```yaml
openframe:
  events:
    enabled: false                      # the whole feature (default false); a change needs a pod restart
    jobs:
      backfill:
        runs:
          organizations: "2026-10-21"   # a run id per type; a new value starts the type again from its first document
        batch-size: 500
        pause: 200ms
        poll-interval: 30s
        lock-at-most-for: 2m            # a tick works for half of it
        max-failures: 3                 # errors in a row before the run is FAILED
      reconciliation:
        cron: "0 0 3 * * *"             # UTC; when a new run is due. The first run starts at once
        batch-size: 1000
        pause: 200ms
        poll-interval: 30s
        lock-at-most-for: 2m
        max-failures: 3
        sample-size: 5                  # sample ids per ERROR line
      projection-tasks:
        batch-size: 1000
        pause: 200ms
        poll-interval: 10s
        lock-at-most-for: 2m            # a task works for half of it per tick
        max-failures: 3                 # errors in a row before the task is FAILED
```

The type keys are the specs' `getType()` names; a key no spec has stops the service.

Only `openframe-saas-stream` has this module, so `openframe.events.enabled` runs all three jobs there. It also provides:

- `@EnableScheduling`; the module does not switch scheduling on for every service that adds it;
- a ShedLock `LockProvider` bean;
- for the backfill, `openframe.events.topics.<type>.enabled: true`. A type switched off is skipped with a WARN,
  because the outbox write would do nothing;
- for the reconciliation, the `AggregateSpec` beans of the published types: the projections of each type switched on
  with `openframe.events.topics.<type>.enabled` are reconciled; a type switched off is not checked
  (see [Projections](../openframe-event-publishing/README.md#projections)).

In `openframe-saas-stream` the scheduling and the lock provider are in `EventJobsConfiguration`, with locks under the
shared's own Redis namespace, and three scheduler threads, one per job (`spring.task.scheduling.pool.size`). The specs come from the
libraries it scans.

## Backfill

**Start** a backfill of a type: set a run id for it under `backfill.runs`, then restart the stream. Any string works;
a date is easy to read. The log shows `Backfill of <type> started, run <id>`, then `done` at the end.

**Repeat** it: set a new run id and restart. The new run starts again from the first document. Leaving the same run id
changes nothing: a DONE run stays done. A run id the job already had is never started again, so pods that still have
the old config during a rolling restart leave the new run alone; always use a new value.

Each batch is written from the documents' current state, then their versions are read again from the primary. A
document written meanwhile is published once more, so its newest state is the last record on the compacted topic
([`republishChanged`](src/main/java/com/openframe/event/jobs/backfill/service/EventBackfillRunner.java#L55)).

**Follow** it in `event_job_runs`, newest run first:

```javascript
db.event_job_runs.find({jobId: "backfill:organizations"}).sort({startedAt: -1})
// runId, status (RUNNING, DONE, FAILED, REPLACED), lastId, processed, failures, lastError, startedAt, updatedAt, finishedAt
```

and with the metric `openframe.events.backfill.documents{type}`.

**Errors:**

- Mongo down: the tick stops and the next one tries again. Nothing is counted.
- Any other error: counted in `failures`, with the message in `lastError`; the next tick tries again. After
  `max-failures` in a row the run is FAILED, with an ERROR line and the metric `openframe.events.backfill.failed{type}`
  (alert `event-backfill-failed`).
- After a fix, restart the stream: a pod that started after the run failed tries it once more, from its `lastId`
  ([`resumeFailed`](src/main/java/com/openframe/event/jobs/backfill/service/EventBackfillService.java#L53)). Pods that were already running leave it FAILED. A new
  run id starts from the beginning instead.

## Reconciliation

**Read** the result in the gauge `openframe.events.reconciliation.mismatches{projection}`: the projected items that
differed in the last finished run. Every pod reports it from `event_job_runs` on each tick, so the alert
`event-reconciliation-drift` takes `max by (namespace, projection)`. A run in progress does not change it.

The job reads the collection of the projection's `projectedClass()` in `_id` batches, only the fields of its
`projectedViewClass()`, and calls `reconcile(projectedItems)`; the projection
decides what a mismatch is, for example [`OrganizationOnTicketsProjection`](../openframe-data-mongo-sync/src/main/java/com/openframe/data/repository/organization/publishing/OrganizationOnTicketsProjection.java#L54)
(a ticket whose organization name differs, or whose organization is gone). The items it returns are read again from the
primary and reconciled again before they count
([`confirm`](src/main/java/com/openframe/event/jobs/reconciliation/service/ReconciliationRunner.java#L78)), so an item updated
meanwhile is not drift.

A run that checked no items logs a WARN, or an ERROR when the collection of `projectedClass()` does not exist. When a
tenant is removed, its items may count as missing sources until its cleanup deletes them.

**Find** the items in the ERROR lines of the stream, one per batch and tenant:

```
Reconciliation of organization-on-tickets in tenant <id>: 3 mismatch(es), for example [<ticket id>: name "Old" differs from organization's "New", ...]
```

**Repair** is automatic: after the second read, the job publishes the current state of each confirmed mismatch's source
again (`PublishedAggregates.publishCurrent`, each source at most once per run), and the projection re-applies it, since
the version store applies an equal version. The run still counts what it found, so the gauge shows the drift before
the repair, and the next run should find none. A mismatch whose source is gone is not published again: the job applies
the missed delete instead (`applyDelete`). A new backfill run of the type is still the way to repair everything at
once.

**Add a projection**: return it from its spec's `projections()` and implement `reconcile`; the job picks it up at the
next start. Its `name()` is the job id (`reconciliation:<name>`) and the metric tag.

**Errors** work as for the backfill, without the resume: a FAILED run waits, and the next cron run starts fresh. It
counts in `openframe.events.reconciliation.failed{projection}` (alert `event-reconciliation-failed`); the gauge keeps the
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
