# OpenFrame Event Processing

Reads the events that [`openframe-event-publishing`](../openframe-event-publishing/README.md) publishes, and applies
each one to the projections of the aggregate, for example the organization name on tickets.

It runs in `openframe-saas-stream` only. It does nothing until you switch it on.

The projections are the `Projection` beans that the services' `AggregateSpec` beans return
(see [Projections](../openframe-event-publishing/README.md#projections)); this module calls their `apply`. Its
packages are internal.

## How it works

```
events.organizations ──> ProjectionListener                one per projection (PublishedEventListeners),
                           │                               group <group-prefix>organizations.<projection>
                           │  (a tombstone, the second record of a delete, is skipped here)
                           ▼
                         ProjectionRunner                  a delete envelope is skipped: no projection handles deletes yet
                           │  for this listener's projection
                           ▼
                         projection.apply(record)          writes its projected items through its own repository
                           │
                           ▼  a failure
                         DefaultErrorHandler ──> retry while Mongo is down, else events.organizations-dlt
```

- A record's Kafka key is the aggregate's Mongo `_id` (the outbox `aggregateId`), not a business id such as
  `organizationId`. The listener passes it to the runner for the logs.
- [`PublishedEventListeners`](src/main/java/com/openframe/processing/listener/PublishedEventListeners.java#L16)
  registers one listener per projection of each spec at startup, all on the type's topic, so a new projection needs no
  listener class. Each has its own consumer group: a failing, slow or replayed projection never holds back the others.
- The value is the `PublishedRecord` envelope: `tenantId`, `version`, `deleted`, `schemaVersion` and `event`. It is
  read into the spec's event class. Unknown fields are ignored, and an enum value the consumer does not know
  is read as `null`, so a newer producer does not send events to the DLT. A `schemaVersion` newer than
  `PublishedRecord.CURRENT_SCHEMA_VERSION` is refused and goes to the DLT, for a newer consumer to replay.
- [`ProjectionRunner`](src/main/java/com/openframe/processing/runner/ProjectionRunner.java#L21) applies the record
  to the listener's projection.
- Versions: each projection runs in one Mongo transaction. The runner reads the version it last stored for that
  projection, tenant and aggregate in `event_projection_versions`; an older event is skipped. Otherwise it first stores
  the event's version with a `$max` upsert, then applies the event (an equal version too, so a backfill, which sends the
  current version, still repairs drift). A failed apply rolls the version back. Two consumers of one projection and aggregate, after a
  rebalance, conflict on that version document: the loser waits and tries again (up to 5 attempts, 750 ms in all), and its
  retry skips the older event. A conflict that lasts longer is retried by the error handler, like Mongo down, so the
  newer event waits instead of going to the DLT. A delete stores its version too. An event handed over to a projection
  task stores its version first; the task is opened after the commit, unless a newer version was stored meanwhile. A
  hand-over that keeps conflicting is retried like any conflict; any other failure sends the record to the DLT, and its
  replay passes the equal stored version. This makes the backfill race, a connector re-snapshot, a DLT replay and a group
  reset harmless.
- Large updates: the runner first asks the projection's `countChanges`, up to the inline limit. Below it, `apply`
  writes inline. At the limit, or while the source already has a task, the event goes to a projection task of
  `openframe-event-jobs` (`ProjectionTaskService`), and the record is done once the task is saved. Without that
  module's beans, a large event is still applied inline, with a WARN.

## Configuration

```yaml
openframe:
  events:
    enabled: false                      # the whole feature (default false); a change needs a pod restart
    processing:
      kafka:                            # Spring's KafkaProperties keys, for the processing cluster only
        bootstrap-servers: ${spring.saas.kafka.bootstrap-servers}               # required, no localhost default
        topic-prefix: ${SHARED_DOMAIN:}events.                                   # required, no default
        group-prefix: ${SHARED_DOMAIN:}${spring.application.name}.processing-    # required, no default
        consumer:
          auto-offset-reset: earliest   # default; a new group reads the whole compacted topic
          max-poll-records: 20          # default
        listener:                       # listener.* keys are applied as Spring Boot applies them
          concurrency: 1
          missing-topics-fatal: true    # default; a topic that does not exist yet stops the start
        back-off:                       # the wait between retries while Mongo is down
          initial-interval: 1s
          multiplier: 2
          max-interval: 30s
        topics:                         # see Topics
          events:                       # used only when a topic is created
            partitions: 1
            replication-factor: 2
            config: {cleanup.policy: compact, min.compaction.lag.ms: 604800000, delete.retention.ms: 604800000}
          dead-letter:
            partitions: 1
            replication-factor: 2
            config: {cleanup.policy: delete, retention.ms: 2592000000}
      large-updates:
        inline-limit: 5000              # default; an event that changes this many items or more goes to a projection task
```

- `kafka` is separate from `spring.kafka` and from the stream's `spring.saas.kafka`. The module adds its own Kafka
  beans and replaces none.
- A topic is `topic-prefix` + the type name (`events.organizations`), its DLT is the topic + `-dlt`, and a projection's
  group is `group-prefix` + the type name + `.` + the projection name (`...processing-organizations.organization-on-tickets`). Each service names its own group: two services in one group would split the
  events, and each would miss half of them.
- The config is read at startup. A config refresh (the AI agent's `ContextRefresher`) does not switch a type on or
  off in a running pod.

## Topics

With `openframe.events.enabled: true`,
[`EventTopicCreator`](src/main/java/com/openframe/processing/topic/EventTopicCreator.java#L31) creates
`<topic-prefix><type>` and `<topic-prefix><type>-dlt` for every spec at startup, before the listeners start, so a new
published type needs no topic config. With the feature off, nothing is created: off means no infrastructure. So the
rollout turns the feature on in the stream before the tenant services publish, and the topics exist before the
connector writes.

- It creates only what is missing and never changes an existing topic, not even its partitions. Another pod creating
  the same topic at the same moment is fine.
- An existing events topic that is not compacted (for example one the broker auto-created before) logs a WARN; fix
  it by hand.
- Kafka unreachable stops the service, with the bootstrap servers in the message.
- A plain `AdminClient`, not `NewTopic` beans: every `KafkaAdmin` in the context would create those too, on its own
  cluster.

## Switching a type

A type moves with all its projections. With the feature on, the stream listens to every spec's topic, so the switch
that matters is `openframe.events.topics.<type>.enabled` in the tenant services: a config change plus a pod restart.
Turn the feature on in the stream first; roll back in the reverse order. Once the tenant services have the type on,
they publish it and their aspect cascades from it stop. A type on in the tenant services while the stream has the
feature off leaves the copies stale: reconciliation and the consumer lag alert show it.

## Add a projection

1. Return it from its spec's `projections()` and implement `apply`:

   ```java
   @Override
   public void apply(PublishedRecord<OrganizationEvent> record) {
       OrganizationEvent event = record.getEvent();
       tickets.updateOrganizationName(event.getOrganizationId(), event.getName(), record.getVersion());
   }
   ```

   - `name()` is unique. It is its metrics tag, and its name in logs and DLT messages.
   - `apply` gets the whole envelope, never a delete.
   - It writes through its own repository, never `MongoTemplate`, with a version guard.
   - The guard writes an item unless its stored version is the same as or newer than the event's
     (`$not: {$gte: v}`). An item with no version field is written too.
   - The guard makes duplicates, replays and out-of-order events harmless.
   - It retries its own write conflicts (`@RetryOnOptimisticLockingFailure`). A conflict that reaches the runner
     sends the record to the DLT.
2. It runs on every event of its type once the feature is on in the stream (see [Switching a type](#switching-a-type)). The aspect
   that writes the same copy skips its cascade while `PublishedAggregateTopics.isPublishing(<type>)` is true.

A new published type needs only its spec: the listeners of its projections are registered from the spec at startup.

A renamed projection gets a new group, which reads the whole compacted topic again; the version guard makes that
harmless. The old group stays on Kafka, and its lag grows with every event until the Kafka lag alert fires. Once the
release runs everywhere, delete the group of a renamed or removed projection:

```bash
kafka-consumer-groups.sh --bootstrap-server <kafka> --delete --group <group-prefix><type>.<old-name>
```

## Errors and the DLT

| What fails | What happens |
|---|---|
| Mongo down: a network error, no server to select, a primary stepping down or recovering, or an error Mongo labels transient ([`MongoUnavailability`](../openframe-event-publishing/src/main/java/com/openframe/publishing/api/util/MongoUnavailability.java#L15), retried as [`MongoUnavailableException`](src/main/java/com/openframe/processing/exception/MongoUnavailableException.java#L4)) | The record is retried without limit, with the back-off. This projection's listener waits, then continues in order; the other projections' listeners go on. |
| A write conflict that lasts past the runner's 5 attempts: another consumer of the same aggregate is still writing | Retried like Mongo down, without limit, until the other consumer commits; then the older event is skipped. |
| A projection: any other exception, and any `Error` but a broken JVM (`OutOfMemoryError`, `InternalError`) | The record goes to `<topic>-dlt` once, for this projection only; the other projections, in their own groups, are not affected. |
| An unreadable value, or a `schemaVersion` newer than this build | The record goes to `<topic>-dlt` without reaching a projection. |

A record goes to the DLT unchanged: same key, same value bytes. Every such record logs one ERROR line with its key
and the exception, and Spring's headers carry the exception: `kafka_dlt-exception-message` names the failed
projection, and `kafka_dlt-exception-stacktrace` holds its stack trace. When several projections fail on one record,
each sends its own copy to the DLT.

## Replay

There is no replay tool; use the standard Kafka tools.

- **Re-apply a whole topic to one projection** (after a bug in it): stop the consumers, then reset that projection's
  group to the start of the compacted topic, which holds the latest event of every aggregate. The other projections of
  the type are not touched:

  ```bash
  kafka-consumer-groups.sh --bootstrap-server <kafka> --group <group-prefix>organizations.<projection> \
    --topic <topic-prefix>organizations --reset-offsets --to-earliest --execute
  ```

  To rewrite items that already carry the same version, first `$unset` that projection's version field on the
  affected items: the guard matches a missing field.
- **Re-apply DLT records** (after the fix is deployed): do not copy them back to the topic. A re-sent old event
  would become the newest record for its key, and compaction would keep it, so a new group would read stale state.
  Instead reset the group of the projection named in its `kafka_dlt-exception-message` header to the failed record's
  offset, from its `kafka_dlt-original-offset` header, with `--to-offset`. Everything after it is applied again, which the version guard makes harmless.

## Startup checks

The service does not start when:

| Problem | Fix |
|---|---|
| Two projections have the same `name()` | Rename one (checked by `AggregateSpecRegistry`). |
| `bootstrap-servers`, `topic-prefix` or `group-prefix` is missing | Set all three. |
| Kafka cannot be reached to create the topics | Check `bootstrap-servers` and the network. |
| A listener's topic does not exist | Create the topics first (`missing-topics-fatal`). |

## Metrics

| Metric | Tags | Meaning |
|---|---|---|
| `openframe.events.processing.apply` (timer) | `projection`, `outcome`: `applied`, `handed_over`, `skipped`, `delete_stored`, `failed`, `mongo_unavailable` | One per event and projection; `handed_over` means a projection task took it, `skipped` that a newer version was already stored. The count is the number of events, the total the time spent. |

## Debugging

```yaml
logging:
  level:
    com.openframe.processing: DEBUG
```

| Line | Meaning |
|---|---|
| `Registered N published aggregate spec(s): [...]` (INFO, at startup) | The specs, and so the topics, this service listens to. |
| `Projection X applied <id> version V of tenant T` | Applied. |
| `Projection X failed for <id> version V of tenant T` (WARN, with the stack trace) | That projection failed; the record goes to the DLT for it. |
| `Record <id> of <topic>-<partition> at offset O goes to <topic>-dlt` (ERROR) | Sent to the DLT. |
| `Delete of ... skipped` / `Tombstone of ... skipped` | A delete; no projection handles deletes yet. |
| `Created the event topic <name>` (INFO, at startup) | The topic did not exist; it now has the configured settings. |
| `Event topic <name> exists with cleanup.policy=delete, not compact` (WARN, at startup) | Fix the topic by hand. |

## Tests

```bash
mvn test -pl openframe-event-processing -am -Dintegration.tests=true
```

[`EventProcessingKafkaIT`](src/test/java/com/openframe/processing/EventProcessingKafkaIT.java#L77) needs Docker: it starts a Kafka broker with Testcontainers, lets the module create
its topics, and checks the whole listener path, the retry and the DLT.
[`EventTopicCreatorIT`](src/test/java/com/openframe/processing/topic/EventTopicCreatorIT.java#L41) checks the created topics' settings and that an existing topic is left alone.
