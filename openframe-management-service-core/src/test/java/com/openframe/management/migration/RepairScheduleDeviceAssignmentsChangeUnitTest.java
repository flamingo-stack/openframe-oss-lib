package com.openframe.management.migration;

import org.bson.Document;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.IndexInfo;
import org.springframework.data.mongodb.core.index.IndexOperations;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.util.Arrays;
import java.util.Date;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * The defect this guards: adding a second device to a schedule failed with E11000, because the
 * pre-split unique index still enforced one assignment row per schedule.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RepairScheduleDeviceAssignmentsChangeUnitTest {

    private static final String COLLECTION = "script_schedules_machines_assigned";
    private static final String LEGACY_INDEX = "tenant_scriptScheduleId";

    @Mock
    private MongoTemplate mongoTemplate;
    @Mock
    private IndexOperations indexOps;

    private final RepairScheduleDeviceAssignmentsChangeUnit changeUnit =
            new RepairScheduleDeviceAssignmentsChangeUnit();

    private void collectionExists() {
        when(mongoTemplate.collectionExists(COLLECTION)).thenReturn(true);
        when(mongoTemplate.indexOps(COLLECTION)).thenReturn(indexOps);
    }

    private void indexes(String... names) {
        when(indexOps.getIndexInfo()).thenReturn(Arrays.stream(names).map(name -> {
            IndexInfo info = mock(IndexInfo.class);
            when(info.getName()).thenReturn(name);
            return info;
        }).toList());
    }

    private void legacyDocuments(Document... documents) {
        when(mongoTemplate.find(any(Query.class), eq(Document.class), eq(COLLECTION)))
                .thenReturn(List.of(documents));
    }

    private Document legacyDocument(String scheduleId, List<String> machineIds) {
        return new Document("_id", "legacy-" + scheduleId)
                .append("tenantId", "tenant-1")
                .append("scriptScheduleId", scheduleId)
                .append("machineIds", machineIds)
                .append("createdBy", "user-1")
                .append("createdAt", new Date(0));
    }

    @Test
    @DisplayName("drops the stale unique index that allowed only one device per schedule")
    void dropsStaleIndex() {
        collectionExists();
        indexes("_id_", LEGACY_INDEX, "tenant_scriptScheduleId_machineId");
        legacyDocuments();

        changeUnit.execution(mongoTemplate);

        verify(indexOps).dropIndex(LEGACY_INDEX);
    }

    @Test
    @DisplayName("a database that never had the stale index is left alone")
    void freshDatabaseIsNoOp() {
        collectionExists();
        indexes("_id_", "tenant_scriptScheduleId_machineId");
        legacyDocuments();

        changeUnit.execution(mongoTemplate);

        verify(indexOps, never()).dropIndex(any());
    }

    @Test
    @DisplayName("a fresh install with no collection yet does nothing at all")
    void missingCollectionIsNoOp() {
        when(mongoTemplate.collectionExists(COLLECTION)).thenReturn(false);

        changeUnit.execution(mongoTemplate);

        verifyNoInteractions(indexOps);
        verify(mongoTemplate, never()).upsert(any(), any(Update.class), eq(COLLECTION));
    }

    @Test
    @DisplayName("a legacy machineIds array becomes one row per machine, and the old document is removed")
    void splitsLegacyDocument() {
        collectionExists();
        indexes(LEGACY_INDEX);
        legacyDocuments(legacyDocument("sched-1", List.of("m-1", "m-2", "m-3")));

        changeUnit.execution(mongoTemplate);

        verify(mongoTemplate, times(3)).upsert(any(Query.class), any(Update.class), eq(COLLECTION));
        verify(mongoTemplate).remove(any(Query.class), eq(COLLECTION));
    }

    @Test
    @DisplayName("the index is dropped BEFORE rows are written — it would otherwise reject the second one")
    void dropsIndexBeforeWritingRows() {
        collectionExists();
        indexes(LEGACY_INDEX);
        legacyDocuments(legacyDocument("sched-1", List.of("m-1", "m-2")));

        changeUnit.execution(mongoTemplate);

        InOrder ordered = inOrder(indexOps, mongoTemplate);
        ordered.verify(indexOps).dropIndex(LEGACY_INDEX);
        ordered.verify(mongoTemplate).upsert(any(Query.class), any(Update.class), eq(COLLECTION));
    }

    @Test
    @DisplayName("duplicate and null machine ids in the legacy array collapse to one row each")
    void deduplicatesMachineIds() {
        collectionExists();
        indexes(LEGACY_INDEX);
        legacyDocuments(legacyDocument("sched-1", Arrays.asList("m-1", "m-1", null, "m-2")));

        changeUnit.execution(mongoTemplate);

        verify(mongoTemplate, times(2)).upsert(any(Query.class), any(Update.class), eq(COLLECTION));
    }

    @Test
    @DisplayName("the natural key is the query and audit fields are set only on insert, so a re-run cannot overwrite")
    void upsertsOnNaturalKeyWithoutOverwriting() {
        collectionExists();
        indexes(LEGACY_INDEX);
        legacyDocuments(legacyDocument("sched-1", List.of("m-1")));

        changeUnit.execution(mongoTemplate);

        ArgumentCaptor<Query> queryCaptor = ArgumentCaptor.forClass(Query.class);
        ArgumentCaptor<Update> updateCaptor = ArgumentCaptor.forClass(Update.class);
        verify(mongoTemplate).upsert(queryCaptor.capture(), updateCaptor.capture(), eq(COLLECTION));

        Document query = queryCaptor.getValue().getQueryObject();
        assertThat(query.get("tenantId")).isEqualTo("tenant-1");
        assertThat(query.get("scriptScheduleId")).isEqualTo("sched-1");
        assertThat(query.get("machineId")).isEqualTo("m-1");

        Document update = updateCaptor.getValue().getUpdateObject();
        assertThat(update).containsOnlyKeys("$setOnInsert");
        Document onInsert = (Document) update.get("$setOnInsert");
        assertThat(onInsert.get("createdBy")).isEqualTo("user-1");
        // The key fields are NOT restated — Mongo builds them from the query's equality terms,
        // and repeating them in the update would be a conflicting path.
        assertThat(onInsert).doesNotContainKeys("tenantId", "scriptScheduleId", "machineId");
    }

    @Test
    @DisplayName("a legacy document missing its schedule id is skipped rather than written as a broken row")
    void skipsMalformedLegacyDocument() {
        collectionExists();
        indexes(LEGACY_INDEX);
        legacyDocuments(new Document("_id", "legacy-broken")
                .append("tenantId", "tenant-1")
                .append("machineIds", List.of("m-1")));

        changeUnit.execution(mongoTemplate);

        verify(mongoTemplate, never()).upsert(any(), any(Update.class), eq(COLLECTION));
        verify(mongoTemplate).remove(any(Query.class), eq(COLLECTION));
    }
}
