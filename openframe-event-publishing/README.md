# OpenFrame Event Publishing

Writes an outbox row for every change of a published Mongo document, in the same transaction as the change.
Debezium will later read the `outbox` collection and send each row to Kafka. Nothing reads the outbox yet.

`openframe-data-mongo-sync` depends on this module, so every service with Mongo has it on the classpath.
It does nothing until you enable it.

Import only from `com.openframe.publishing.api`. The other packages are internal to the module.

## How it works

```
service ──> OrganizationRepository.save(org)
              │  (outer aspects, such as TicketCascadeAspect, run here: outside the transaction)
              ▼
            PublishingRepositoryInterceptor          inside the repository proxy
              │
              ▼
            one Mongo transaction:  1. the write   2. its outbox rows (one per save, two per delete)
```

- A repository becomes published by extending `PublishingMongoRepository<D, ID, S>`. `S` is the aggregate's spec,
  which turns a document into its public event.
- `PublishingRepositoryPostProcessor` adds the interceptor inside the proxy of every such repository. So aspects on
  the repository wrap it from outside and never run inside the outbox transaction.
- Writes that do not go through the repository (custom methods) publish themselves through `OutboxPublisher`.
- The service does not start when a published repository is set up wrongly (see [Startup checks](#startup-checks)).

## Configuration

```yaml
openframe:
  events:
    publishing:
      enabled: false      # the whole module (default false); a change needs a pod restart
    topics:
      organizations:      # one key per PublishedAggregateType; an unknown key stops the service
        publish: false    # per aggregate (default false); a change needs a pod restart
```

| `publishing.enabled` | `publish` | Result |
|---|---|---|
| `false` | any | Nothing of this module exists. A `PublishingMongoRepository` is a plain Spring Data repository, exactly as before. A topic set to `true` gets a WARN at startup. |
| `true` | `false` | The interceptor and the startup checks run. Writes run without a transaction and without outbox rows. |
| `true` | `true` | Each write and its outbox rows commit together, or roll back together. |

Also needed: `spring.data.mongodb.enabled: true`. With `publish: true`, Mongo must be a replica set, because
transactions need one.

## Publish a new aggregate

Organization is the example; its files are in `openframe-data-mongo-sync`, next to `OrganizationRepository`.

1. Add the type to [`PublishedAggregateType`](src/main/java/com/openframe/publishing/api/PublishedAggregateType.java).
   Its name is the outbox `aggregateType`, the config key and the topic suffix.
2. Give the document a `@Version Long version` field. The version orders the events for consumers.
3. Write the event, only the public fields that consumers need. Never the Mongo document, never secrets:

   ```java
   @Data
   @Builder
   @NoArgsConstructor
   @AllArgsConstructor
   public class OrganizationEvent implements PublishedEvent {
       private String organizationId;
       private String name;
       private Boolean isDefault;
       private OrganizationStatus status;
   }
   ```

4. Write the spec as a bean:

   ```java
   @Component
   public class OrganizationSpec implements PublishedAggregateSpec<Organization, OrganizationEvent> {

       @Override
       public PublishedAggregateType getType() {
           return PublishedAggregateType.ORGANIZATIONS;
       }

       @Override
       public OrganizationEvent toEvent(Organization organization) {
           ...
       }
   }
   ```

5. Change the repository:

   ```java
   public interface OrganizationRepository
           extends PublishingMongoRepository<Organization, String, OrganizationSpec>, CustomOrganizationRepository {
   ```

6. Find every other write of that collection (custom repository methods, `MongoTemplate` calls, services) and
   publish each one with `OutboxPublisher`, or the change is silently not published.
7. Add the config key, with `publish: false`, and enable it per environment.

## What is published

| Write | Outbox rows |
|---|---|
| `save`, `saveAll`, `insert` | One row per saved document: its payload is the envelope with the event, and the saved version. |
| `delete(document)`, `deleteAll(documents)` | Reads only `_id`, `version` and `tenantId` of the given documents first, by their ids, then the two delete rows per document found. The tenant and version come from the database, not from the given entity. |
| `deleteById`, `deleteAllById` | Reads only `_id`, `version` and `tenantId` first, then the two delete rows per document found. A `null` argument goes to Spring Data unchanged. |
| `deleteAll()` | Removes through the template, which a tenant app scopes to its tenant (Spring Data's own `deleteAll()` is not scoped). With `publish` on: reads the ids, removes them in chunks of 1,000, the two delete rows each. |
| Derived deletes (`deleteByName`, `@Query(delete = true)`) | The two delete rows per returned document. They must return the documents, not a count. |
| Reads | Nothing. |

Every payload is the envelope [`PublishedRecord`](src/main/java/com/openframe/publishing/api/PublishedRecord.java):
`tenantId`, `version`, `deleted`, `schemaVersion` and `event` (the spec's public event, `null` on a delete). The envelope
is built from the row's own fields, so the two never disagree.

A delete writes **two rows**. Both have `deleted: true` and a version one above the stored version, so a consumer
applies them after the document's last change.

- The first row is the delete envelope, with `event: null`.
- The second row has `payload: null`. Debezium sends it as a Kafka tombstone, and compaction then removes the key from
  the topic.

The outbox connector needs two settings for this (stage 5):

- `route.tombstone.on.empty.payload: true`. Debezium's default is `false`.
- A value converter without schemas, for example `value.converter.schemas.enable: false`. The consumers read the plain
  envelope; a value wrapped in a schema goes to their DLT.

**Rows for every write.** The interceptor does not compare with the stored document, so a save that changes only an
unpublished field still writes its row. Consumers apply events by version, so extra rows do no harm.

## Custom writes

A write outside the repository's base methods publishes itself. Each `OutboxPublisher` helper takes the write as a
lambda and runs it with its rows in one transaction:

| Helper | Use for |
|---|---|
| `publishChanged(spec, write)` | A write that returns the new state: `findAndModify` with `returnNew`, `save`. |
| `publishChangedByIds(spec, ids, write)` | A write that returns only a count, such as `updateMulti`: the documents are read again after it. |
| `publishDeleted(spec, write)` | A write that returns what it removed: `findAndRemove`, `findAllAndRemove`. |
| `publishDeleted(spec, stored, write)` | A delete that returns nothing, when the documents are known before it. Their tenant and version are read again by id. |
| `publishDeletedByIds(spec, ids, write)` | A delete by ids that returns nothing. |

```java
public Organization rename(String id, String name) {
    Query byId = Query.query(Criteria.where("id").is(id));
    Update update = new Update().set("name", name);
    FindAndModifyOptions returnNew = FindAndModifyOptions.options().returnNew(true);
    return outboxPublisher.publishChanged(organizationSpec,
            () -> mongoTemplate.findAndModify(byId, update, returnNew, Organization.class));
}
```

More examples: [`WidgetCustomRepositoryImpl`](src/test/java/com/openframe/publishing/repository/WidgetCustomRepositoryImpl.java).

## What is not published

These writes produce no outbox row, and nothing warns about them:

- a plain `MongoTemplate` / `MongoOperations` write, including a custom method that does not use the helpers;
- raw driver calls (`getCollection(...)`, `bulkOps`, `execute`) and aggregations with `$merge` / `$out`;
- Mongock ChangeUnits;
- writes from outside the service: Compass, scripts, another service;
- tenant offboarding (`MongoTenantCleanupStep` in saas-infra removes documents with `mongoTemplate.remove`).

## Startup checks

`PublishingRepositoryStartupCheck` stops the service when a published repository:

| Problem | Fix |
|---|---|
| Its spec class is not exactly one bean | Make the spec a `@Component`, once. |
| Its document has no `@Version` field | Add `@Version Long version`. |
| It has no `PublishingRepositoryInterceptor` | The repository was created outside Spring Data's normal setup; let the auto-configuration create it. |
| It has an `@Update` method | It returns no documents to publish; write a custom method with `publishChanged` or `publishChangedByIds`. |
| A derived delete returns a count, `void` or `boolean` | Return the deleted documents, for example as a `List`. |
| A custom method carries `@PublishesChange` / `@PublishesDelete` | These markers are internal to `PublishingMongoRepository`; use `OutboxPublisher` instead. |
| A Spring Data write method is not marked on `PublishingMongoRepository` | A new Spring Data version added a write; redeclare it there with a marker. |

`PublishedAggregateStartupCheck` also stops the service when a topic has `publish: true` but no spec bean exists for
its type.

## The outbox row

Collection `outbox`, document [`OutboxEvent`](src/main/java/com/openframe/publishing/persistence/OutboxEvent.java):

| Field | Value |
|---|---|
| `aggregateType` | The type name, for example `organizations`. |
| `aggregateId` | The document's `_id`; the Kafka key, once Debezium sends the rows. |
| `tenantId` | The document's tenant, if it has one. |
| `version` | The saved version, or the stored version + 1 for both delete rows. |
| `deleted` | `true` for both delete rows. |
| `schemaVersion` | `1`. |
| `occurredAt` | When the row was written. |
| `payload` | The `PublishedRecord` envelope as JSON (Jackson names, ISO dates); `null` for the second delete row; the key is always written, because Debezium's router needs it. |

`OutboxIndexInitializer` creates the TTL index `outbox_occurredAt_ttl` at startup: rows expire after 7 days. To
change the TTL later, write a migration that drops the index first; `createIndex` with other options fails at
startup with `IndexOptionsConflict`.

## Transactions and errors

`MongoTransactionRunner` runs each write with its rows. It is not a bean and does not retry: a save has already
increased the version in the object, so a retry would overwrite the other write.

| Error in the transaction | What the caller gets |
|---|---|
| Write conflict (code 112) | `OptimisticLockingFailureException`; methods with `@RetryOnOptimisticLockingFailure` retry with a fresh read. |
| Duplicate key (code 11000) | `DuplicateKeyException`. |
| Anything else | The original exception. |

## Debugging

```yaml
logging:
  level:
    com.openframe.publishing: DEBUG   # TRACE also logs one line per outbox row
```

A normal save logs:

```
OrganizationRepository.save is a CHANGE write of organizations
publishChanged of organizations: starting
Wrote 1 outbox row(s) of organizations
Outbox transaction committed
```

What to look for:

| Line | Meaning |
|---|---|
| `Publish is off for <type>` | The write ran without rows: `publish` is off for that type. |
| `The write returned no documents: no outbox rows` | The write changed nothing, or returned nothing to publish. |
| `Read N of M id(s) … before the delete` | N lower than M: some ids did not exist, or belong to another tenant. |
| `Outbox transaction rolled back: <exception>` | The write and its rows were both undone. |
| `… with a null argument goes to Spring Data unpublished` | A base delete got `null`; Spring Data refuses it. |

No `… is a … write` line at all for a repository call means the interceptor is not there: check that
`openframe.events.publishing.enabled` is `true`.

## Tests

```bash
mvn test -pl openframe-event-publishing -am -Dintegration.tests=true
```

The integration tests (`*IT`) need Docker: they start a Mongo replica set with Testcontainers.
