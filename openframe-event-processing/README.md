# OpenFrame Event Processing

Reads the events that [`openframe-event-publishing`](../openframe-event-publishing/README.md) publishes, and applies
each one to the projections of the aggregate, for example the organization name on tickets.

It runs in `openframe-saas-stream` only. It does nothing until you switch it on.

The projections are the `Projection` beans that the services' `AggregateSpec` beans return
(see [Projections](../openframe-event-publishing/README.md#projections)); this module calls their `apply`. Its
packages are internal.

## How it works

```
events.organizations ──> PublishedTypeListener             one per spec type (PublishedEventListeners), group <group-prefix>organizations
                           │  (a tombstone, the second record of a delete, is skipped here)
                           ▼
                         ProjectionRunner                  a delete envelope is skipped: no projection handles deletes yet
                           │  for each projection of the type's spec, unless its mode is aspect
                           ▼
                         projection.apply(record)          writes its projected items through its own repository
                           │
                           ▼  a failure
                         DefaultErrorHandler ──> retry while Mongo is down, else events.organizations-dlt
```

- A record's Kafka key is the aggregate's Mongo `_id` (the outbox `aggregateId`), not a business id such as
  `organizationId`. The listener passes it to the runner for the logs.
- [`PublishedEventListeners`](src/main/java/com/openframe/processing/listener/PublishedEventListeners.java#L16)
  registers one listener per spec type at startup, so a new published type needs no listener class.
- The value is the `PublishedRecord` envelope: `tenantId`, `version`, `deleted`, `schemaVersion` and `event`. It is
  read into the spec's event class. Unknown fields are ignored, and an enum value the consumer does not know
  is read as `null`, so a newer producer does not send events to the DLT. A `schemaVersion` newer than
  `PublishedRecord.CURRENT_SCHEMA_VERSION` is refused and goes to the DLT, for a newer consumer to replay.
- [`ProjectionRunner`](src/main/java/com/openframe/processing/runner/ProjectionRunner.java#L27) runs each projection on its own, in name order: a
  failed projection does not stop the others.
- Versions: before a projection runs, the runner reads the version it last stored for that projection, tenant and
  aggregate in `projection_versions`. An older event is skipped; an equal or newer one is applied (so a backfill, which
  sends the current version, still repairs drift), then its version is stored with a `$max` upsert. A delete stores
  its version too, and an event handed over to a projection task is stored when the task is saved. This makes the
  backfill race, a connector re-snapshot, a DLT replay and a group reset harmless.
- Large updates: the runner first asks the projection's `countChanges`, up to the inline limit. Below it, `apply`
  writes inline. At the limit, or while the source already has a task, the event goes to a projection task of
  `openframe-event-jobs` (`ProjectionTaskService`), and the record is done once the task is saved. With projection
  tasks off, a large event is still applied inline, with a WARN.

## Configuration

```yaml
openframe:
  events:
    enabled: false                      # the whole feature (default false); a change needs a pod restart
    topics:
      organizations:
        enabled: false                  # per type: its topics, listener and projections in this service
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
        topics:                         # needs enabled: true too; see Topics
          create: false                 # default; creates every published type's topic and DLT at startup
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
      projections:
        organization-on-tickets:        # one key per projection name(); an unknown name logs an ERROR
          mode: aspect                  # aspect (default), both or events; a change needs a pod restart
```

- `kafka` is separate from `spring.kafka` and from the stream's `spring.saas.kafka`. The module adds its own Kafka
  beans and replaces none.
- A topic is `topic-prefix` + the type name (`events.organizations`), its DLT is the topic + `-dlt`, and its group
  is `group-prefix` + the type name. Each service names its own group: two services in one group would split the
  events, and each would miss half of them.
- The config is read at startup. A config refresh (the AI agent's `ContextRefresher`) does not switch a type on or
  off in a running pod.

## Topics

With `openframe.events.enabled: true`,
[`EventTopicCreator`](src/main/java/com/openframe/processing/topic/EventTopicCreator.java#L31) creates
`<topic-prefix><type>` and `<topic-prefix><type>-dlt` for every spec at startup, before the listeners start, so a new
published type needs no topic config. With processing off, nothing is created: off means no infrastructure. So the
rollout enables processing (every processor on `aspect`) before the outbox connector is registered, and the topics
exist before the connector writes.

- It creates only what is missing and never changes an existing topic, not even its partitions. Another pod creating
  the same topic at the same moment is fine.
- An existing events topic that is not compacted (for example one the broker auto-created before) logs a WARN; fix
  it by hand.
- Kafka unreachable stops the service, with the bootstrap servers in the message.
- A plain `AdminClient`, not `NewTopic` beans: every `KafkaAdmin` in the context would create those too, on its own
  cluster.

## Switching a type

A type moves with all its projections. Switch it on in the stream's config first, then in the tenant services'
configs, each a config change plus a pod restart; roll back in the reverse order. While only the stream has it on, the
aspects still write and the stream gets no events of that type; once the tenant services have it on, they publish it
and their aspect cascades from it stop. A type on in the tenant services but off in the stream leaves the copies
stale: reconciliation and the consumer lag alert show it.

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
2. It runs as soon as its type is switched on in the stream (see [Switching a type](#switching-a-type)). The aspect
   that writes the same copy skips its cascade while `PublishedAggregateTopics.isPublishing(<type>)` is true.

A new published type needs only its spec: the listener of its topic is registered from the spec at startup.

## Errors and the DLT

| What fails | What happens |
|---|---|
| Mongo down: a network error, no server to select, a primary stepping down or recovering, or an error Mongo labels transient ([`MongoUnavailability`](../openframe-event-publishing/src/main/java/com/openframe/publishing/api/util/MongoUnavailability.java#L24), retried as [`MongoUnavailableException`](src/main/java/com/openframe/processing/exception/MongoUnavailableException.java#L4)) | The record is retried without limit, with the back-off. The topic waits, then continues in order. |
| A projection: any other exception, a write conflict too, and any `Error` but a broken JVM (`OutOfMemoryError`, `InternalError`) | The other projections still run. The record then goes to `<topic>-dlt` once. |
| An unreadable value, or a `schemaVersion` newer than this build | The record goes to `<topic>-dlt` without reaching a projection. |

A record goes to the DLT unchanged: same key, same value bytes. Every such record logs one ERROR line with its key
and the exception, and Spring's headers carry the exception: `kafka_dlt-exception-message` names the failed
projections, and `kafka_dlt-exception-stacktrace` holds every failure's stack trace (the first as the cause, the
others as suppressed).

## Replay

There is no replay tool; use the standard Kafka tools.

- **Re-apply a whole topic** (after a projection bug): stop the consumers, then reset the group to the start of the
  compacted topic, which holds the latest event of every aggregate:

  ```bash
  kafka-consumer-groups.sh --bootstrap-server <kafka> --group <group-prefix>organizations \
    --topic <topic-prefix>organizations --reset-offsets --to-earliest --execute
  ```

  To rewrite items that already carry the same version, first `$unset` that projection's version field on the
  affected items: the guard matches a missing field.
- **Re-apply DLT records** (after the fix is deployed): do not copy them back to the topic. A re-sent old event
  would become the newest record for its key, and compaction would keep it, so a new group would read stale state.
  Instead reset the group to the failed record's offset, from its `kafka_dlt-original-offset` header, with
  `--to-offset`. Everything after it is applied again, which the version guard makes harmless.

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
| `Projection X failed for <id> version V of tenant T` (WARN, with the stack trace) | That projection failed; the record goes to the DLT after the others ran. |
| `Record <id> of <topic>-<partition> at offset O goes to <topic>-dlt` (ERROR) | Sent to the DLT. |
| `openframe.events.processing.projections names [...], but no projection has that name` (ERROR, at startup) | A typo, or a config newer than this image. |
| `Delete of ... skipped` / `Tombstone of ... skipped` | A delete; no projection handles deletes yet. |
| `Created the event topic <name>` (INFO, at startup) | The topic did not exist; it now has the configured settings. |
| `Event topic <name> exists with cleanup.policy=delete, not compact` (WARN, at startup) | Fix the topic by hand. |

## Tests

```bash
mvn test -pl openframe-event-processing -am -Dintegration.tests=true
```

[`EventProcessingKafkaIT`](src/test/java/com/openframe/processing/EventProcessingKafkaIT.java#L76) needs Docker: it starts a Kafka broker with Testcontainers, lets the module create
its topics, and checks the whole listener path, the retry and the DLT.
[`EventTopicCreatorIT`](src/test/java/com/openframe/processing/topic/EventTopicCreatorIT.java#L41) checks the created topics' settings and that an existing topic is left alone.
