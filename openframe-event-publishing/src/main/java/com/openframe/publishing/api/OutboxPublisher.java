package com.openframe.publishing.api;

import com.openframe.publishing.api.model.PublishedRecord;
import com.openframe.publishing.api.spec.AggregateSpec;
import com.openframe.publishing.api.spec.PublishedEvent;
import com.openframe.publishing.config.PublishedAggregateTopics;
import com.openframe.publishing.persistence.OutboxEvent;
import com.openframe.publishing.transaction.MongoTransactionRunner;
import lombok.extern.slf4j.Slf4j;
import com.mongodb.client.result.DeleteResult;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.cfg.DateTimeFeature;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;

import static com.openframe.publishing.api.PublishedDocuments.ID_FIELD;

// Runs a write and writes the outbox rows of the documents it changed, in one transaction. With publish off, only the write.
@Slf4j
public class OutboxPublisher {

    private static final int DELETE_CHUNK_SIZE = 1_000;
    private static final TypeReference<Map<String, Object>> PAYLOAD_TYPE = new TypeReference<>() {
    };

    // Our own, not the service's ObjectMapper: an event must look the same whichever service writes it.
    private static final JsonMapper EVENT_MAPPER = JsonMapper.builder()
            .disable(DateTimeFeature.WRITE_DATES_AS_TIMESTAMPS)
            .build();

    private final PublishedAggregateTopics topics;
    // Not a repository: an app with only its own repositories, such as saas-infra, must still start.
    private final MongoOperations mongoOperations;
    private final ObjectProvider<MongoTransactionRunner> transactionRunner;
    private final PublishedDocuments documents;

    public OutboxPublisher(PublishedAggregateTopics topics,
                           MongoOperations mongoOperations,
                           ObjectProvider<MongoTransactionRunner> transactionRunner) {
        this.topics = topics;
        this.mongoOperations = mongoOperations;
        this.transactionRunner = transactionRunner;
        this.documents = new PublishedDocuments(mongoOperations);
    }

    // The write returns the new state: save, insert, findAndModify with returnNew.
    public <R> R publishChanged(AggregateSpec<?, ?> spec, Supplier<R> write) {
        log.debug("publishChanged of {}: starting", spec.getType());
        return whenPublishing(spec, write, () -> {
            R result = write.get();
            List<Object> changed = documentsOf(result);
            insertChangedRows(spec, changed);
            return result;
        });
    }

    // The write returns what it removed: findAndRemove, findAllAndRemove, a derived delete returning documents.
    public <R> R publishDeleted(AggregateSpec<?, ?> spec, Supplier<R> write) {
        log.debug("publishDeleted of {}: starting", spec.getType());
        return whenPublishing(spec, write, () -> {
            R result = write.get();
            List<Object> deleted = documentsOf(result);
            insertDeletedRows(spec, deleted);
            return result;
        });
    }

    // A delete of known documents that returns none, such as delete(document): only their ids are used, and the tenant and
    // version are read from the database, so a hand-built entity without a tenant cannot give its envelope a wrong one.
    public <R> R publishDeleted(AggregateSpec<?, ?> spec, Supplier<? extends Collection<?>> stored, Supplier<R> write) {
        Collection<?> given = stored.get();
        List<String> ids = given.stream().map(documents::idOf).toList();
        return publishDeletedByIds(spec, ids, write);
    }

    // A delete by ids: a tombstone needs only the id, tenant and version, so only those fields are read before the write.
    public <R> R publishDeletedByIds(AggregateSpec<?, ?> spec, Collection<?> ids, Supplier<R> write) {
        log.debug("publishDeletedByIds of {}: starting", spec.getType());
        return whenPublishing(spec, write, () -> {
            List<?> deleted = findDeleteFieldsByIds(spec, ids);
            log.debug("Read {} of {} id(s) of {} before the delete", deleted.size(), ids.size(), spec.getType());
            R result = write.get();
            insertDeletedRows(spec, deleted);
            return result;
        });
    }

    // deleteAll() through the template, which a tenant app scopes to its tenant; Spring Data's own deleteAll() it does not.
    public void publishDeletedAll(AggregateSpec<?, ?> spec) {
        log.debug("publishDeletedAll of {}: starting", spec.getType());
        Class<?> documentClass = PublishedDocuments.classOf(spec);
        Query everything = new Query();
        whenPublishing(spec, () -> {
            DeleteResult removed = mongoOperations.remove(everything, documentClass);
            log.debug("deleteAll() of {} with publish off removed {} document(s)", spec.getType(), removed.getDeletedCount());
            return removed;
        }, () -> {
            Query allDeleteFields = new Query();
            List<?> deleted = findDeleteFields(documentClass, allDeleteFields);
            log.debug("deleteAll() of {} read {} document(s) to remove", spec.getType(), deleted.size());
            removeInChunks(documentClass, deleted);
            insertDeletedRows(spec, deleted);
            return null;
        });
    }

    // A write that returns only a count, such as updateMulti: the named documents are read again after it.
    public <R> R publishChangedByIds(AggregateSpec<?, ?> spec, Collection<?> ids, Supplier<R> write) {
        log.debug("publishChangedByIds of {}: starting", spec.getType());
        return whenPublishing(spec, write, () -> {
            R result = write.get();
            List<?> changed = findByIds(spec, ids);
            log.debug("Read {} of {} id(s) of {} after the write", changed.size(), ids.size(), spec.getType());
            insertChangedRows(spec, changed);
            return result;
        });
    }

    // A write beside the documents that changes what their projections read (a directory link): raises their version, then publishes.
    public <R> R republishByIds(AggregateSpec<?, ?> spec, Collection<?> ids, Supplier<R> write) {
        log.debug("republishByIds of {}: starting", spec.getType());
        return whenPublishing(spec, write, () -> {
            R result = write.get();
            increaseVersions(spec, ids);
            List<?> changed = findByIds(spec, ids);
            insertChangedRows(spec, changed);
            return result;
        });
    }

    // The backfill's write: the documents' current state, read and written in one transaction; returns the version of each row.
    public Map<String, Long> publishCurrent(AggregateSpec<?, ?> spec, Collection<?> ids) {
        log.debug("publishCurrent of {}: starting", spec.getType());
        return whenPublishing(spec, Map::of, () -> {
            List<?> current = findByIds(spec, ids);
            insertChangedRows(spec, current);
            return versionsById(current);
        });
    }

    private Map<String, Long> versionsById(List<?> documentsWritten) {
        Map<String, Long> versions = new LinkedHashMap<>();
        for (Object document : documentsWritten) {
            String id = documents.idOf(document);
            long version = documents.versionOf(document);
            versions.put(id, version);
        }
        return versions;
    }

    private <R> R whenPublishing(AggregateSpec<?, ?> spec, Supplier<R> write, Supplier<R> writeWithRows) {
        String type = spec.getType();
        if (!topics.isPublishing(type)) {
            log.debug("Publish is off for {}: the write runs without outbox rows", type);
            return write.get();
        }
        MongoTransactionRunner runner = transactionRunner.getObject();
        return runner.run(writeWithRows::get);
    }

    // The payload is the envelope as JSON, the way consumers read it: Jackson names, ISO dates.
    private void insertChangedRows(AggregateSpec<?, ?> spec, Collection<?> changed) {
        List<OutboxEvent> rows = new ArrayList<>();
        for (Object document : changed) {
            PublishedEvent event = eventOf(spec, document);
            long version = documents.versionOf(document);
            String tenantId = PublishedDocuments.tenantOf(document);
            Map<String, Object> payload = payloadOf(tenantId, version, false, event);
            OutboxEvent row = rowOf(spec, document).payload(payload).build();
            rows.add(row);
        }
        insertRows(rows);
    }

    // Two rows per delete, one above the stored version: the delete envelope, then a row Debezium turns into a tombstone.
    private void insertDeletedRows(AggregateSpec<?, ?> spec, Collection<?> deleted) {
        List<OutboxEvent> rows = new ArrayList<>();
        for (Object document : deleted) {
            long version = documents.versionOf(document) + 1;
            String tenantId = PublishedDocuments.tenantOf(document);
            Map<String, Object> payload = payloadOf(tenantId, version, true, null);
            OutboxEvent deleteRow = rowOf(spec, document).payload(payload).build();
            OutboxEvent tombstoneRow = rowOf(spec, document).build();
            rows.add(deleteRow);
            rows.add(tombstoneRow);
        }
        insertRows(rows);
    }

    private static Map<String, Object> payloadOf(String tenantId, long version, boolean deleted, PublishedEvent event) {
        PublishedRecord<PublishedEvent> envelope = PublishedRecord.builder()
                .tenantId(tenantId)
                .version(version)
                .deleted(deleted)
                .schemaVersion(PublishedRecord.CURRENT_SCHEMA_VERSION)
                .event(event)
                .build();
        return EVENT_MAPPER.convertValue(envelope, PAYLOAD_TYPE);
    }

    private void insertRows(List<OutboxEvent> rows) {
        if (rows.isEmpty()) {
            log.debug("The write returned no documents: no outbox rows");
            return;
        }
        mongoOperations.insert(rows, OutboxEvent.class);
        log.debug("Wrote {} outbox row(s) of {}", rows.size(), rows.getFirst().getAggregateType());
        for (OutboxEvent row : rows) {
            log.trace("Outbox row: aggregateId={} tenantId={} payload={}",
                    row.getAggregateId(), row.getTenantId(), row.getPayload());
        }
    }

    private OutboxEvent.OutboxEventBuilder rowOf(AggregateSpec<?, ?> spec, Object document) {
        String aggregateType = spec.getType();
        String id = documents.idOf(document);
        String tenantId = PublishedDocuments.tenantOf(document);
        Instant now = Instant.now();
        return OutboxEvent.builder()
                .aggregateType(aggregateType)
                .aggregateId(id)
                .tenantId(tenantId)
                .occurredAt(now);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static PublishedEvent eventOf(AggregateSpec spec, Object document) {
        return spec.toEvent(document);
    }

    private void increaseVersions(AggregateSpec<?, ?> spec, Collection<?> ids) {
        if (ids.isEmpty()) {
            return;
        }
        Class<?> documentClass = PublishedDocuments.classOf(spec);
        String versionField = documents.findVersionField(documentClass);
        Criteria idIn = Criteria.where(ID_FIELD).in(ids);
        Query byIds = Query.query(idIn);
        Update increment = new Update().inc(versionField, 1);
        mongoOperations.updateMulti(byIds, increment, documentClass);
    }

    private List<?> findByIds(AggregateSpec<?, ?> spec, Collection<?> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        Class<?> documentClass = PublishedDocuments.classOf(spec);
        Criteria idIn = Criteria.where(ID_FIELD).in(ids);
        Query byIds = Query.query(idIn);
        return mongoOperations.find(byIds, documentClass);
    }

    private List<?> findDeleteFieldsByIds(AggregateSpec<?, ?> spec, Collection<?> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        Class<?> documentClass = PublishedDocuments.classOf(spec);
        Criteria idIn = Criteria.where(ID_FIELD).in(ids);
        Query byIds = Query.query(idIn);
        return findDeleteFields(documentClass, byIds);
    }

    private List<?> findDeleteFields(Class<?> documentClass, Query query) {
        documents.includeDeleteFields(documentClass, query);
        return mongoOperations.find(query, documentClass);
    }

    // Chunks keep each $in far below Mongo's 16 MB command limit.
    private void removeInChunks(Class<?> documentClass, List<?> deleted) {
        List<Object> ids = new ArrayList<>();
        for (Object document : deleted) {
            Object id = documents.identifierOf(document);
            ids.add(id);
        }
        int count = ids.size();
        for (int start = 0; start < count; start += DELETE_CHUNK_SIZE) {
            int end = Math.min(start + DELETE_CHUNK_SIZE, count);
            List<Object> chunk = ids.subList(start, end);
            Criteria idIn = Criteria.where(ID_FIELD).in(chunk);
            Query byIds = Query.query(idIn);
            DeleteResult removed = mongoOperations.remove(byIds, documentClass);
            log.debug("Removed {} of {} document(s) in the chunk from index {}", removed.getDeletedCount(), chunk.size(), start);
        }
    }

    private static List<Object> documentsOf(Object result) {
        List<Object> documents = new ArrayList<>();
        if (result instanceof Optional<?> optional) {
            optional.ifPresent(documents::add);
        } else if (result instanceof Iterable<?> iterable) {
            iterable.forEach(documents::add);
        } else if (result != null) {
            documents.add(result);
        }
        return documents;
    }
}
