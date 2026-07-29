package com.openframe.management.migration;

import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.IndexOperations;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Objects;

/**
 * Finishes the schema change that turned a schedule's device assignment from one document holding a
 * {@code machineIds} array into one row per (schedule, machine) pair.
 *
 * <p>That change altered the mapping but left the database as it was, and two things outlive it:
 *
 * <ol>
 *   <li><b>The old unique index</b> {@code (tenantId, scriptScheduleId)}. Spring Data's
 *       auto-index-creation only ever creates indexes — it never drops one that disappeared from the
 *       annotations — so every database provisioned before that commit still enforces
 *       one-row-per-schedule. The first device added to a schedule succeeds and the second fails with
 *       {@code E11000}, which is how this surfaced.</li>
 *   <li><b>Documents still in the old shape.</b> The current model has no {@code machineIds} field,
 *       so those documents map to a row with a null {@code machineId} and are skipped by every
 *       reader: the assignments they hold are invisible, and the schedules that owned them look
 *       empty. They are read here as raw {@link Document}s for exactly that reason — mapping them to
 *       the entity would silently drop the very field being migrated.</li>
 * </ol>
 *
 * <p>The two steps are ordered, not independent: the stale index permits a single row per schedule,
 * so the split rows cannot be written while it still exists.
 *
 * <p>Both steps are idempotent and safe on a fresh install — a missing collection, a missing index
 * and an absence of legacy documents are each a no-op, and the rows are upserted on their natural
 * key so a partially-migrated collection converges rather than conflicting.
 */
@Slf4j
@ChangeUnit(id = "repair-schedule-device-assignments", order = "009", author = "openframe")
public class RepairScheduleDeviceAssignmentsChangeUnit {

    private static final String COLLECTION = "script_schedules_machines_assigned";
    private static final String LEGACY_INDEX = "tenant_scriptScheduleId";

    private static final String ID_FIELD = "_id";
    private static final String TENANT_ID_FIELD = "tenantId";
    private static final String SCHEDULE_ID_FIELD = "scriptScheduleId";
    private static final String MACHINE_ID_FIELD = "machineId";
    private static final String LEGACY_MACHINE_IDS_FIELD = "machineIds";
    private static final String CREATED_BY_FIELD = "createdBy";
    private static final String CREATED_AT_FIELD = "createdAt";

    @Execution
    public void execution(MongoTemplate mongoTemplate) {
        if (!mongoTemplate.collectionExists(COLLECTION)) {
            log.info("Repair schedule device assignments: collection {} does not exist; skipping", COLLECTION);
            return;
        }
        dropLegacyIndex(mongoTemplate);
        splitLegacyDocuments(mongoTemplate);
    }

    /**
     * Intentionally empty. Re-creating the unique {@code (tenantId, scriptScheduleId)} index would
     * restore the defect this removes, and it would now fail outright against any schedule that has
     * more than one device. The split rows are valid under the current model, so leaving them in
     * place is the correct rollback state.
     */
    @RollbackExecution
    public void rollback() {
    }

    private void dropLegacyIndex(MongoTemplate mongoTemplate) {
        IndexOperations indexOps = mongoTemplate.indexOps(COLLECTION);
        boolean present = indexOps.getIndexInfo().stream()
                .anyMatch(index -> LEGACY_INDEX.equals(index.getName()));
        if (!present) {
            log.info("Legacy index {}.{} is absent; nothing to drop", COLLECTION, LEGACY_INDEX);
            return;
        }
        indexOps.dropIndex(LEGACY_INDEX);
        log.info("Dropped legacy unique index {}.{} — a schedule may now hold more than one device",
                COLLECTION, LEGACY_INDEX);
    }

    private void splitLegacyDocuments(MongoTemplate mongoTemplate) {
        Query legacy = new Query(Criteria.where(LEGACY_MACHINE_IDS_FIELD).exists(true));
        List<Document> documents = mongoTemplate.find(legacy, Document.class, COLLECTION);
        if (documents.isEmpty()) {
            log.info("No legacy {} documents to split", COLLECTION);
            return;
        }

        int rows = 0;
        for (Document document : documents) {
            rows += splitDocument(mongoTemplate, document);
            mongoTemplate.remove(new Query(Criteria.where(ID_FIELD).is(document.get(ID_FIELD))), COLLECTION);
        }
        log.info("Split {} legacy assignment document(s) into {} row(s)", documents.size(), rows);
    }

    private int splitDocument(MongoTemplate mongoTemplate, Document document) {
        List<String> machineIds = document.getList(LEGACY_MACHINE_IDS_FIELD, String.class);
        if (machineIds == null || machineIds.isEmpty()) {
            return 0;
        }
        String tenantId = document.getString(TENANT_ID_FIELD);
        String scheduleId = document.getString(SCHEDULE_ID_FIELD);
        if (tenantId == null || scheduleId == null) {
            log.warn("Skipping legacy assignment document {} — missing tenantId or scriptScheduleId",
                    document.get(ID_FIELD));
            return 0;
        }

        int written = 0;
        for (String machineId : machineIds.stream().filter(Objects::nonNull).distinct().toList()) {
            upsertRow(mongoTemplate, tenantId, scheduleId, machineId, document);
            written++;
        }
        return written;
    }

    private void upsertRow(MongoTemplate mongoTemplate, String tenantId, String scheduleId,
                           String machineId, Document source) {
        // The natural key is the query, so an upsert converges: a row already written in the new
        // shape keeps its own audit fields rather than being overwritten with the legacy document's.
        // tenantId/scriptScheduleId/machineId are not repeated in the update — Mongo builds an
        // inserted document from the query's equality terms, and restating them here would be a
        // conflicting path.
        Query row = new Query(Criteria.where(TENANT_ID_FIELD).is(tenantId)
                .and(SCHEDULE_ID_FIELD).is(scheduleId)
                .and(MACHINE_ID_FIELD).is(machineId));
        Update update = new Update()
                .setOnInsert(CREATED_BY_FIELD, source.getString(CREATED_BY_FIELD))
                .setOnInsert(CREATED_AT_FIELD, createdAt(source));
        mongoTemplate.upsert(row, update, COLLECTION);
    }

    private Date createdAt(Document source) {
        Object createdAt = source.get(CREATED_AT_FIELD);
        return createdAt instanceof Date date ? date : Date.from(Instant.now());
    }
}
