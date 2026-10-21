# OpenFrame Event Processing

Reads the events that [`openframe-event-publishing`](../openframe-event-publishing/README.md) publishes, and applies
each one to the rows of other collections that copy the aggregate, for example the organization name on tickets.

It runs in `openframe-saas-stream` only. It does nothing until you switch it on.

Processors implement [`EventProcessor`](src/main/java/com/openframe/processing/api/EventProcessor.java). The other
packages are internal to the module.

## How it works

```
events.organizations ──> OrganizationEventListener         one listener per topic, group <group-prefix>organizations
                           │  (a tombstone, the second record of a delete, is skipped here)
                           ▼
                         EventProcessorRunner              a delete envelope is skipped: no processor handles deletes yet
                           │  for each processor of the type, unless its mode is aspect
                           ▼
                         processor.process(record)         writes its target rows through its own repository
                           │
                           ▼  a failure
                         DefaultErrorHandler ──> retry while Mongo is down, else events.organizations-dlt
```

- A record's Kafka key is the aggregate's Mongo `_id` (the outbox `aggregateId`), not a business id such as
  `organizationId`. The listener passes it to the runner for the logs.
- The value is the `PublishedRecord` envelope: `tenantId`, `version`, `deleted`, `schemaVersion` and `event`. It is
  read into the listener's parameter type. Unknown fields are ignored, and an enum value the consumer does not know
  is read as `null`, so a newer producer does not send events to the DLT. A `schemaVersion` newer than
  `PublishedRecord.CURRENT_SCHEMA_VERSION` is refused and goes to the DLT, for a newer consumer to replay.
- [`EventProcessorRunner`](src/main/java/com/openframe/processing/runner/EventProcessorRunner.java#L22) runs each processor on its own: a failed
  processor does not stop the others.

## Configuration

```yaml
openframe:
  events:
    processing:
      enabled: false                    # the whole module (default false); a change needs a pod restart
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
      processors:
        organization-on-tickets:        # one key per processor name; an unknown name stops the service
          mode: aspect                  # aspect (default), both or events; a change needs a pod restart
```

- `kafka` is separate from `spring.kafka` and from the stream's `spring.saas.kafka`. The module adds its own Kafka
  beans and replaces none.
- A topic is `topic-prefix` + the type name (`events.organizations`), its DLT is the topic + `-dlt`, and its group
  is `group-prefix` + the type name. Each service names its own group: two services in one group would split the
  events, and each would miss half of them.
- The config is read at startup. A config refresh (the AI agent's `ContextRefresher`) does not change the modes of a
  running pod.

## Modes

The mode says who updates a processor's target rows: the old aspect in the tenant services, or the processor.

| Mode | Aspect | Processor |
|---|---|---|
| `aspect` (default) | writes | skipped |
| `both` | writes | writes |
| `events` | skipped | writes |

Switch in two steps, each a config change plus a pod restart: `aspect` → `both`, and once every pod runs `both`,
`both` → `events`. Roll back the same way. In `both` someone always writes, whatever the order of the stream's and
the tenant services' configs inside a step. The cost: a processor that is behind can write an older value over the
aspect's newer one, until it reads the newer event. The aspects read the mode from stage 6 on.

## Add a processor

1. Write the processor as a bean:

   ```java
   @Component
   @RequiredArgsConstructor
   public class OrganizationOnTickets implements EventProcessor<OrganizationEvent> {

       private final TicketProcessorRepository tickets;

       @Override
       public String name() {
           return "organization-on-tickets";
       }

       @Override
       public PublishedAggregateType getType() {
           return PublishedAggregateType.ORGANIZATIONS;
       }

       @Override
       public long process(PublishedRecord<OrganizationEvent> record) {
           OrganizationEvent event = record.getEvent();
           return tickets.updateOrganizationName(event.getOrganizationId(), event.getName(), record.getVersion());
       }
   }
   ```

   - `name()` is unique. It is the key of its mode, its metrics tag, and its name in logs and DLT messages.
   - `process` gets the whole envelope, never a delete. It returns the number of rows it wrote, for the metrics.
   - It writes through its own repository, never `MongoTemplate`, with a version guard.
   - The guard writes a row unless its stored version is the same as or newer than the event's
     (`$not: {$gte: v}`). A row with no version field is written too.
   - The guard makes duplicates, replays and out-of-order events harmless.
   - It retries its own write conflicts (`@RetryOnOptimisticLockingFailure`). A conflict that reaches the runner
     sends the record to the DLT.
2. Add its mode under `openframe.events.processing.processors`, with `mode: aspect`, and switch it per environment
   (see [Modes](#modes)).

## Add a topic

A new published type needs a listener. Copy
[`OrganizationEventListener`](src/main/java/com/openframe/processing/listener/OrganizationEventListener.java#L19):
implement [`AggregateEventListener`](src/main/java/com/openframe/processing/listener/AggregateEventListener.java#L6), return the type from `getType()`, take the payload as
`PublishedRecord<YourEvent>` with `@Payload(required = false)`, and register the bean in
[`EventProcessingKafkaAutoConfiguration`](src/main/java/com/openframe/processing/config/EventProcessingKafkaAutoConfiguration.java#L50). The service does not start when a processor's type has no
listener ([`EventListenerStartupCheck`](src/main/java/com/openframe/processing/config/EventListenerStartupCheck.java#L17)).

## Errors and the DLT

| What fails | What happens |
|---|---|
| Mongo down: a network error, no server to select, a primary stepping down or recovering, or an error Mongo labels transient ([`MongoUnavailableException`](src/main/java/com/openframe/processing/runner/MongoUnavailableException.java#L14)) | The record is retried without limit, with the back-off. The topic waits, then continues in order. |
| A processor: any other exception, a write conflict too, and any `Error` but a broken JVM (`OutOfMemoryError`, `InternalError`) | The other processors still run. The record then goes to `<topic>-dlt` once. |
| An unreadable value, or a `schemaVersion` newer than this build | The record goes to `<topic>-dlt` without reaching a processor. |

A record goes to the DLT unchanged: same key, same value bytes. Every such record logs one ERROR line with its key
and the exception, and Spring's headers carry the exception: `kafka_dlt-exception-message` names the failed
processors, and `kafka_dlt-exception-stacktrace` holds every failure's stack trace (the first as the cause, the
others as suppressed).

## Replay

There is no replay tool; use the standard Kafka tools.

- **Re-apply a whole topic** (after a processor bug): stop the consumers, then reset the group to the start of the
  compacted topic, which holds the latest event of every aggregate:

  ```bash
  kafka-consumer-groups.sh --bootstrap-server <kafka> --group <group-prefix>organizations \
    --topic <topic-prefix>organizations --reset-offsets --to-earliest --execute
  ```

  To rewrite rows that already carry the same version, first `$unset` that processor's version field on the
  affected rows: the guard matches a missing field.
- **Re-apply DLT records** (after the fix is deployed): do not copy them back to the topic. A re-sent old event
  would become the newest record for its key, and compaction would keep it, so a new group would read stale state.
  Instead reset the group to the failed record's offset, from its `kafka_dlt-original-offset` header, with
  `--to-offset`. Everything after it is applied again, which the version guard makes harmless.

## Startup checks

The service does not start when:

| Problem | Fix |
|---|---|
| Two processors have the same `name()` | Rename one. |
| A `mode` is not `aspect`, `both` or `events` | Fix the value. |
| A processor's type has no listener | Add the listener (see [Add a topic](#add-a-topic)). |
| `bootstrap-servers`, `topic-prefix` or `group-prefix` is missing | Set all three. |
| A listener's topic does not exist | Create the topics first (`missing-topics-fatal`). |

A name under `processors` that matches no processor only logs an ERROR: an image rolled back under a newer config
must still start. That processor, if it exists, stays on `aspect`.

## Metrics

| Metric | Tags | Meaning |
|---|---|---|
| `openframe.events.processing.apply` (timer) | `processor`, `outcome`: `applied`, `failed`, `mongo_unavailable` | One per processor run; the count is the number of events, the total the time spent. |
| `openframe.events.processing.rows` (counter) | `processor` | Rows written. |

## Debugging

```yaml
logging:
  level:
    com.openframe.processing: DEBUG
```

| Line | Meaning |
|---|---|
| `Registered N processor(s): [...]` (INFO, at startup) | The processors this service runs. |
| `Processor X skipped: mode aspect` | The aspect still does the work for X. |
| `Processor X wrote N row(s) for <id> version V of tenant T` | Applied. |
| `Processor X failed for <id> version V of tenant T` (WARN, with the stack trace) | That processor failed; the record goes to the DLT after the others ran. |
| `Record <id> of <topic>-<partition> at offset O goes to <topic>-dlt` (ERROR) | Sent to the DLT. |
| `openframe.events.processing.processors names [...], but no processor has that name` (ERROR, at startup) | A typo, or a config newer than this image. |
| `Delete of ... skipped` / `Tombstone of ... skipped` | A delete; no processor handles deletes yet. |

## Tests

```bash
mvn test -pl openframe-event-processing -am -Dintegration.tests=true
```

[`EventProcessingKafkaIT`](src/test/java/com/openframe/processing/EventProcessingKafkaIT.java#L72) needs Docker: it starts a Kafka broker with Testcontainers and checks the whole listener
path, the retry and the DLT.
