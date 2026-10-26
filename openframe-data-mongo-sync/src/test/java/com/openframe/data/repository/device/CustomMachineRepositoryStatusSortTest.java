package com.openframe.data.repository.device;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.filter.MachineQueryFilter;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.convert.MongoConverter;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomMachineRepositoryStatusSortTest {

    private static final String TENANT_ID = "tenant-1";
    private static final List<String> EXPECTED_ORDER = List.of("ONLINE", "PENDING", "PENDING_DELETION", "OFFLINE");
    private static final int UNKNOWN_RANK = 4;

    @Mock private MongoTemplate mongoTemplate;
    @Mock private MongoConverter converter;
    @Captor private ArgumentCaptor<Aggregation> aggregationCaptor;
    @InjectMocks private CustomMachineRepositoryImpl repository;

    @Test
    @DisplayName("status ASC: rank from the explicit order, then sort by (rank, _id) ascending")
    void statusAsc_ranksByExplicitOrder() {
        // setup
        stubAggregate(List.of());

        // execution
        repository.findMachinesWithCursor(TENANT_ID, filter(), null, null, 10, "status", "ASC");

        // verifications
        List<Document> stages = capturedStages();
        assertThat(stages).hasSize(4);
        assertThat(stages.get(0).get("$match", Document.class)).containsEntry("tenantId", TENANT_ID);
        Document rank = stages.get(1).get("$addFields", Document.class).get("_statusRank", Document.class);
        List<?> cond = rank.getList("$cond", Object.class);
        assertThat(cond.get(0)).isEqualTo(new Document("$in", List.of("$status", EXPECTED_ORDER)));
        assertThat(cond.get(1)).isEqualTo(new Document("$indexOfArray", List.of(EXPECTED_ORDER, "$status")));
        assertThat(cond.get(2)).isEqualTo(UNKNOWN_RANK);
        assertThat(stages.get(2).get("$sort", Document.class))
                .containsExactly(entry("_statusRank", 1), entry("_id", 1));
        assertThat(stages.get(3)).containsEntry("$limit", 10L);
        verify(mongoTemplate, never()).find(any(Query.class), eq(Machine.class));
    }

    @Test
    @DisplayName("status DESC: the same rank, sorted by (rank, _id) descending")
    void statusDesc_reversesExplicitOrder() {
        // setup
        stubAggregate(List.of());

        // execution
        repository.findMachinesWithCursor(TENANT_ID, filter(), null, null, 5, "status", "DESC");

        // verifications
        List<Document> stages = capturedStages();
        assertThat(stages.get(2).get("$sort", Document.class))
                .containsExactly(entry("_statusRank", -1), entry("_id", -1));
    }

    @Test
    @DisplayName("status ASC cursor: continues after the cursor's rank, or after its _id within the same rank")
    void statusAscCursor_keysetOverRankAndId() {
        // setup
        ObjectId cursorId = new ObjectId();
        stubCursorDocument(cursorId, DeviceStatus.PENDING);
        stubAggregate(List.of());

        // execution
        repository.findMachinesWithCursor(TENANT_ID, filter(), null, cursorId.toHexString(), 10, "status", "ASC");

        // verifications
        List<Document> stages = capturedStages();
        assertThat(stages).hasSize(5);
        List<Document> branches = stages.get(2).get("$match", Document.class).getList("$or", Document.class);
        assertThat(branches).containsExactly(
                new Document("_statusRank", new Document("$gt", 1)),
                new Document("_statusRank", 1).append("_id", new Document("$gt", cursorId)));
    }

    @Test
    @DisplayName("status DESC cursor: continues before the cursor's rank, or before its _id within the same rank")
    void statusDescCursor_keysetOverRankAndId() {
        // setup
        ObjectId cursorId = new ObjectId();
        stubCursorDocument(cursorId, DeviceStatus.OFFLINE);
        stubAggregate(List.of());

        // execution
        repository.findMachinesWithCursor(TENANT_ID, filter(), null, cursorId.toHexString(), 10, "status", "DESC");

        // verifications
        List<Document> branches = capturedStages().get(2).get("$match", Document.class).getList("$or", Document.class);
        assertThat(branches).containsExactly(
                new Document("_statusRank", new Document("$lt", 3)),
                new Document("_statusRank", 3).append("_id", new Document("$lt", cursorId)));
    }

    @Test
    @DisplayName("status cursor whose document is gone: falls back to a plain _id keyset")
    void statusCursor_missingDocument_fallsBackToId() {
        // setup
        ObjectId cursorId = new ObjectId();
        when(mongoTemplate.findById(cursorId, Machine.class)).thenReturn(null);
        stubAggregate(List.of());

        // execution
        repository.findMachinesWithCursor(TENANT_ID, filter(), null, cursorId.toHexString(), 10, "status", "ASC");

        // verifications
        assertThat(capturedStages().get(2).get("$match", Document.class))
                .isEqualTo(new Document("_id", new Document("$gt", cursorId)));
    }

    @Test
    @DisplayName("status sort with a malformed cursor: first page, no cursor stage")
    void statusCursor_malformed_ignored() {
        // setup
        stubAggregate(List.of());

        // execution
        repository.findMachinesWithCursor(TENANT_ID, filter(), null, "not-an-object-id", 10, "status", "ASC");

        // verifications
        assertThat(capturedStages()).hasSize(4);
        verify(mongoTemplate, never()).findById(any(), eq(Machine.class));
    }

    @Test
    @DisplayName("status sort maps the aggregation rows back to Machine documents in pipeline order")
    void statusSort_mapsRowsInOrder() {
        // setup
        Document online = new Document("hostname", "online-1");
        Document offline = new Document("hostname", "offline-1");
        stubAggregate(List.of(online, offline));
        Machine first = machine(DeviceStatus.ONLINE);
        Machine second = machine(DeviceStatus.OFFLINE);
        when(mongoTemplate.getConverter()).thenReturn(converter);
        when(converter.read(Machine.class, online)).thenReturn(first);
        when(converter.read(Machine.class, offline)).thenReturn(second);

        // execution
        List<Machine> machines = repository.findMachinesWithCursor(TENANT_ID, filter(), null, null, 10, "status", "ASC");

        // verifications
        assertThat(machines).containsExactly(first, second);
    }

    @Test
    @DisplayName("sorting by another field keeps the plain find() path")
    void otherSortField_usesFind() {
        // execution
        repository.findMachinesWithCursor(TENANT_ID, filter(), null, null, 10, "hostname", "ASC");

        // verifications
        verify(mongoTemplate).find(any(Query.class), eq(Machine.class));
        verify(mongoTemplate, never()).aggregate(any(Aggregation.class), eq(Machine.class), eq(Document.class));
    }

    @Test
    @DisplayName("statusRank: ONLINE < PENDING < PENDING_DELETION < OFFLINE, missing status last")
    void statusRank_followsExplicitOrder() {
        assertThat(CustomMachineRepositoryImpl.statusRank(DeviceStatus.ONLINE)).isEqualTo(0);
        assertThat(CustomMachineRepositoryImpl.statusRank(DeviceStatus.PENDING)).isEqualTo(1);
        assertThat(CustomMachineRepositoryImpl.statusRank(DeviceStatus.PENDING_DELETION)).isEqualTo(2);
        assertThat(CustomMachineRepositoryImpl.statusRank(DeviceStatus.OFFLINE)).isEqualTo(3);
        assertThat(CustomMachineRepositoryImpl.statusRank(null)).isEqualTo(UNKNOWN_RANK);
    }

    @ParameterizedTest
    @EnumSource(value = DeviceStatus.class, names = {"ONLINE", "PENDING", "PENDING_DELETION", "OFFLINE"},
            mode = EnumSource.Mode.EXCLUDE)
    @DisplayName("statusRank: every status outside the explicit order ranks after OFFLINE")
    void statusRank_otherStatusesRankLast(DeviceStatus status) {
        assertThat(CustomMachineRepositoryImpl.statusRank(status)).isEqualTo(UNKNOWN_RANK);
    }

    private static MachineQueryFilter filter() {
        return MachineQueryFilter.builder().build();
    }

    private static Machine machine(DeviceStatus status) {
        Machine machine = new Machine();
        machine.setStatus(status);
        return machine;
    }

    private static Map.Entry<String, Object> entry(String key, Object value) {
        return Map.entry(key, value);
    }

    private void stubCursorDocument(ObjectId cursorId, DeviceStatus status) {
        Machine cursorDoc = machine(status);
        cursorDoc.setId(cursorId.toHexString());
        when(mongoTemplate.findById(cursorId, Machine.class)).thenReturn(cursorDoc);
    }

    private void stubAggregate(List<Document> rows) {
        AggregationResults<Document> results = new AggregationResults<>(rows, new Document());
        when(mongoTemplate.aggregate(any(Aggregation.class), eq(Machine.class), eq(Document.class))).thenReturn(results);
    }

    private List<Document> capturedStages() {
        verify(mongoTemplate).aggregate(aggregationCaptor.capture(), eq(Machine.class), eq(Document.class));
        return aggregationCaptor.getValue().toPipeline(Aggregation.DEFAULT_CONTEXT);
    }
}
