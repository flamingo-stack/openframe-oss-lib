package com.openframe.publishing.api;

import com.openframe.publishing.config.PublishedAggregateTopics;
import com.openframe.publishing.persistence.OutboxEvent;
import com.openframe.publishing.transaction.MongoTransactionRunner;
import lombok.extern.slf4j.Slf4j;
import com.mongodb.client.result.DeleteResult;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.cfg.DateTimeFeature;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;

import static com.openframe.publishing.api.PublishedDocuments.ID_FIELD;

// Runs a write and writes the outbox rows of the documents it changed, in one transaction. With publish off, only the write.
@Slf4j
public class OutboxPublisher {

    private static final int SCHEMA_VERSION = 1;
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
    public <R> R publishChanged(PublishedAggregateSpec<?, ?> spec, Supplier<R> write) {
        log.debug("publishChanged of {}: starting", spec.getType().getName());
        return whenPublishing(spec, write, () -> {
            R result = write.get();
            List<Object> changed = documentsOf(result);
            insertChangedRows(spec, changed);
            return result;
        });
    }

    // The write returns what it removed: findAndRemove, findAllAndRemove, a derived delete returning documents.
    public <R> R publishDeleted(PublishedAggregateSpec<?, ?> spec, Supplier<R> write) {
        log.debug("publishDeleted of {}: starting", spec.getType().getName());
        return whenPublishing(spec, write, () -> {
            R result = write.get();
            List<Object> deleted = documentsOf(result);
            insertDeletedRows(spec, deleted);
            return result;
        });
    }

    // The documents are known before a write that returns none, such as delete(document).
    public <R> R publishDeleted(PublishedAggregateSpec<?, ?> spec, Supplier<? extends Collection<?>> stored, Supplier<R> write) {
        log.debug("publishDeleted of {}: starting", spec.getType().getName());
        return whenPublishing(spec, write, () -> {
            Collection<?> deleted = stored.get();
            R result = write.get();
            insertDeletedRows(spec, deleted);
            return result;
        });
    }

    // A delete by ids: a tombstone needs only the id, tenant and version, so only those fields are read before the write.
    public <R> R publishDeletedByIds(PublishedAggregateSpec<?, ?> spec, Collection<?> ids, Supplier<R> write) {
        log.debug("publishDeletedByIds of {}: starting", spec.getType().getName());
        return whenPublishing(spec, write, () -> {
            List<?> deleted = findDeleteFieldsByIds(spec, ids);
            log.debug("Read {} of {} id(s) of {} before the delete", deleted.size(), ids.size(), spec.getType().getName());
            R result = write.get();
            insertDeletedRows(spec, deleted);
            return result;
        });
    }

    // deleteAll() through the template, which a tenant app scopes to its tenant; Spring Data's own deleteAll() it does not.
    public void publishDeletedAll(PublishedAggregateSpec<?, ?> spec) {
        log.debug("publishDeletedAll of {}: starting", spec.getType().getName());
        Class<?> documentClass = PublishedDocuments.classOf(spec);
        Query everything = new Query();
        whenPublishing(spec, () -> {
            DeleteResult removed = mongoOperations.remove(everything, documentClass);
            log.debug("deleteAll() of {} with publish off removed {} document(s)", spec.getType().getName(), removed.getDeletedCount());
            return removed;
        }, () -> {
            Query allDeleteFields = new Query();
            List<?> deleted = findDeleteFields(documentClass, allDeleteFields);
            log.debug("deleteAll() of {} read {} document(s) to remove", spec.getType().getName(), deleted.size());
            removeInChunks(documentClass, deleted);
            insertDeletedRows(spec, deleted);
            return null;
        });
    }

    // A write that returns only a count, such as updateMulti: the named documents are read again after it.
    public <R> R publishChangedByIds(PublishedAggregateSpec<?, ?> spec, Collection<?> ids, Supplier<R> write) {
        log.debug("publishChangedByIds of {}: starting", spec.getType().getName());
        return whenPublishing(spec, write, () -> {
            R result = write.get();
            List<?> changed = findByIds(spec, ids);
            log.debug("Read {} of {} id(s) of {} after the write", changed.size(), ids.size(), spec.getType().getName());
            insertChangedRows(spec, changed);
            return result;
        });
    }

    private <R> R whenPublishing(PublishedAggregateSpec<?, ?> spec, Supplier<R> write, Supplier<R> writeWithRows) {
        PublishedAggregateType type = spec.getType();
        if (!topics.isPublishing(type)) {
            log.debug("Publish is off for {}: the write runs without outbox rows", type.getName());
            return write.get();
        }
        MongoTransactionRunner runner = transactionRunner.getObject();
        return runner.run(writeWithRows::get);
    }

    // The payload is the event as JSON, the way consumers read it: Jackson names, ISO dates.
    private void insertChangedRows(PublishedAggregateSpec<?, ?> spec, Collection<?> changed) {
        List<OutboxEvent> rows = new ArrayList<>();
        for (Object document : changed) {
            PublishedEvent event = eventOf(spec, document);
            Map<String, Object> payload = EVENT_MAPPER.convertValue(event, PAYLOAD_TYPE);
            long version = documents.versionOf(document);
            OutboxEvent row = rowOf(spec, document).version(version).payload(payload).build();
            rows.add(row);
        }
        insertRows(rows);
    }

    // A tombstone, no payload: one above the stored version, so a consumer applies it after the document's last change.
    private void insertDeletedRows(PublishedAggregateSpec<?, ?> spec, Collection<?> deleted) {
        List<OutboxEvent> rows = new ArrayList<>();
        for (Object document : deleted) {
            long version = documents.versionOf(document) + 1;
            OutboxEvent row = rowOf(spec, document).version(version).deleted(true).build();
            rows.add(row);
        }
        insertRows(rows);
    }

    private void insertRows(List<OutboxEvent> rows) {
        if (rows.isEmpty()) {
            log.debug("The write returned no documents: no outbox rows");
            return;
        }
        mongoOperations.insert(rows, OutboxEvent.class);
        log.debug("Wrote {} outbox row(s) of {}", rows.size(), rows.getFirst().getAggregateType());
        for (OutboxEvent row : rows) {
            log.trace("Outbox row: aggregateId={} tenantId={} version={} deleted={}",
                    row.getAggregateId(), row.getTenantId(), row.getVersion(), row.isDeleted());
        }
    }

    private OutboxEvent.OutboxEventBuilder rowOf(PublishedAggregateSpec<?, ?> spec, Object document) {
        PublishedAggregateType type = spec.getType();
        String aggregateType = type.getName();
        String id = documents.idOf(document);
        String tenantId = PublishedDocuments.tenantOf(document);
        Instant now = Instant.now();
        return OutboxEvent.builder()
                .aggregateType(aggregateType)
                .aggregateId(id)
                .tenantId(tenantId)
                .schemaVersion(SCHEMA_VERSION)
                .occurredAt(now);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static PublishedEvent eventOf(PublishedAggregateSpec spec, Object document) {
        return spec.toEvent(document);
    }

    private List<?> findByIds(PublishedAggregateSpec<?, ?> spec, Collection<?> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        Class<?> documentClass = PublishedDocuments.classOf(spec);
        Criteria idIn = Criteria.where(ID_FIELD).in(ids);
        Query byIds = Query.query(idIn);
        return mongoOperations.find(byIds, documentClass);
    }

    private List<?> findDeleteFieldsByIds(PublishedAggregateSpec<?, ?> spec, Collection<?> ids) {
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
