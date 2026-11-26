package com.openframe.data.repository.device;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.TelemetryStatus;
import com.openframe.data.document.device.filter.DeviceFacetDimension;
import com.openframe.data.document.device.filter.MachineQueryFilter;
import com.openframe.data.repository.cursor.CursorPosition;
import com.openframe.data.repository.cursor.KeysetCursor;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomMachineRepositoryConnectivityTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String CONNECTIVITY = "connectivity";
    private static final String TELEMETRY_STATUS = "telemetryStatus";
    private static final String RANK_FIELD = "_connectivityRank";
    private static final Document ONLINE_RANK = new Document("$cond",
            List.of(new Document("$eq", List.of("$telemetryStatus", "ONLINE")), 1, 0));
    private static final String CURSOR_HEX = "65f1a2b3c4d5e6f708192a3b";
    private static final ObjectId CURSOR_ID = new ObjectId(CURSOR_HEX);
    private static final CursorPosition NO_POSITION = new CursorPosition.None();

    @Mock private MongoTemplate mongoTemplate;
    @Captor private ArgumentCaptor<Aggregation> aggregationCaptor;
    @InjectMocks private CustomMachineRepositoryImpl repository;

    @Test
    void buildDeviceQuery_connectivityFilter_addsTelemetryStatusIn() {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().connectivity(List.of("ONLINE")).build();

        // execution
        Document query = repository.buildDeviceQuery(filter, null).getQueryObject();

        // verifications
        assertThat(andClauses(query)).contains(new Document(TELEMETRY_STATUS, new Document("$in", List.of("ONLINE"))));
    }

    @Test
    void buildDeviceQuery_connectivityFilter_keepsDeletedGuard() {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().connectivity(List.of("OFFLINE")).build();

        // execution
        Document query = repository.buildDeviceQuery(filter, null).getQueryObject();

        // verifications
        assertThat(andClauses(query)).contains(new Document("status", new Document("$ne", DeviceStatus.DELETED)));
    }

    @Test
    void buildDeviceQuery_emptyConnectivity_addsNoTelemetryClause() {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().connectivity(List.of()).build();

        // execution
        Document query = repository.buildDeviceQuery(filter, null).getQueryObject();

        // verifications
        assertThat(andClauses(query)).noneMatch(clause -> clause.containsKey(TELEMETRY_STATUS));
    }

    @Test
    void buildDeviceQuery_connectivityExcluded_dropsTheConnectivityArmOnly() {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder()
                .connectivity(List.of("ONLINE")).statuses(List.of("ONLINE", "OFFLINE")).build();

        // execution
        Document query = repository.buildDeviceQuery(filter, null, TELEMETRY_STATUS).getQueryObject();

        // verifications
        assertThat(andClauses(query))
                .noneMatch(clause -> clause.containsKey(TELEMETRY_STATUS))
                .contains(new Document("status", new Document("$in", List.of("ONLINE", "OFFLINE"))));
    }

    @Test
    void facet_connectivity_groupsByTelemetryStatusWithoutTheConnectivityArm() {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().connectivity(List.of("ONLINE")).build();
        stubAggregate(List.of(new Document("_id", "ONLINE").append("count", 3), new Document("_id", null).append("count", 1)));

        // execution
        Map<String, Integer> counts = repository.facet(TENANT_ID, filter, null, DeviceFacetDimension.CONNECTIVITY);

        // verifications
        assertThat(counts).containsExactly(Map.entry("ONLINE", 3));
        List<Document> stages = capturedStages();
        Document match = stages.get(0).get("$match", Document.class);
        assertThat(match).containsEntry("tenantId", TENANT_ID);
        assertThat(andClauses(match)).noneMatch(clause -> clause.containsKey(TELEMETRY_STATUS));
        assertThat(stages.get(1).get("$group", Document.class)).containsEntry("_id", "$" + TELEMETRY_STATUS);
    }

    @Test
    void isSortableField_connectivity_isSortable() {
        // execution
        boolean sortable = repository.isSortableField(CONNECTIVITY);

        // verifications
        assertThat(sortable).isTrue();
    }

    @Test
    void connectivityDesc_ranksOnlineFirst() {
        // setup
        stubAggregate(List.of());

        // execution
        repository.findMachinesWithCursor(TENANT_ID, filter(), null, NO_POSITION, false, 10, CONNECTIVITY, "DESC");

        // verifications
        List<Document> stages = capturedStages();
        assertThat(stages).hasSize(4);
        assertThat(stages.get(0).get("$match", Document.class)).containsEntry("tenantId", TENANT_ID);
        assertThat(stages.get(1).get("$addFields", Document.class)).containsEntry(RANK_FIELD, ONLINE_RANK);
        assertThat(stages.get(2).get("$sort", Document.class))
                .containsExactly(Map.entry(RANK_FIELD, -1), Map.entry("_id", -1));
        assertThat(stages.get(3)).containsEntry("$limit", 10L);
        verify(mongoTemplate, never()).find(any(Query.class), eq(Machine.class));
    }

    @Test
    void connectivityAsc_ranksOfflineFirst() {
        // setup
        stubAggregate(List.of());

        // execution
        repository.findMachinesWithCursor(TENANT_ID, filter(), null, NO_POSITION, false, 5, CONNECTIVITY, "ASC");

        // verifications
        assertThat(capturedStages().get(2).get("$sort", Document.class))
                .containsExactly(Map.entry(RANK_FIELD, 1), Map.entry("_id", 1));
    }

    @Test
    void connectivityDescCursor_keysetOverRankAndId() {
        // setup
        ObjectId cursorId = new ObjectId();
        stubCursorDocument(cursorId, TelemetryStatus.ONLINE);
        stubAggregate(List.of());

        // execution
        repository.findMachinesWithCursor(TENANT_ID, filter(), null, rowId(cursorId), false, 10, CONNECTIVITY, "DESC");

        // verifications
        List<Document> stages = capturedStages();
        assertThat(stages).hasSize(5);
        List<Document> branches = stages.get(2).get("$match", Document.class).getList("$or", Document.class);
        assertThat(branches).containsExactly(
                new Document(RANK_FIELD, new Document("$lt", 1)),
                new Document(RANK_FIELD, 1).append("_id", new Document("$lt", cursorId)));
    }

    @Test
    void connectivityAscCursor_nullTelemetryRanksAsNotOnline() {
        // setup
        ObjectId cursorId = new ObjectId();
        stubCursorDocument(cursorId, null);
        stubAggregate(List.of());

        // execution
        repository.findMachinesWithCursor(TENANT_ID, filter(), null, rowId(cursorId), false, 10, CONNECTIVITY, "ASC");

        // verifications
        List<Document> branches = capturedStages().get(2).get("$match", Document.class).getList("$or", Document.class);
        assertThat(branches).containsExactly(
                new Document(RANK_FIELD, new Document("$gt", 0)),
                new Document(RANK_FIELD, 0).append("_id", new Document("$gt", cursorId)));
    }

    @ParameterizedTest
    @CsvSource({
            "ASC, -1",
            "DESC, 1"
    })
    void connectivityBackward_sortsAgainstTheDisplayDirection(String direction, int order) {
        // setup
        stubAggregate(List.of());

        // execution
        repository.findMachinesWithCursor(TENANT_ID, filter(), null, NO_POSITION, true, 10, CONNECTIVITY, direction);

        // verifications
        List<Document> stages = capturedStages();
        assertThat(stages.get(0).get("$match", Document.class)).containsEntry("tenantId", TENANT_ID);
        assertThat(stages.get(2).get("$sort", Document.class))
                .containsExactly(Map.entry(RANK_FIELD, order), Map.entry("_id", order));
    }

    @ParameterizedTest
    @MethodSource("rankKeysetsInEachFetchDirection")
    void connectivityKeysetCursor_continuesFromTheCarriedRankInFetchDirection(
            KeysetCursor cursor, boolean backward, String operator, int order) {
        // setup
        String direction = cursor.direction().name();
        stubAggregate(List.of());

        // execution
        repository.findMachinesWithCursor(TENANT_ID, filter(), null, cursor, backward, 10, CONNECTIVITY, direction);

        // verifications
        List<Document> stages = capturedStages();
        assertThat(stages).hasSize(5);
        assertThat(stages.get(2).get("$match", Document.class).getList("$or", Document.class)).containsExactly(
                new Document(RANK_FIELD, new Document(operator, 1)),
                new Document(RANK_FIELD, 1).append("_id", new Document(operator, CURSOR_ID)));
        assertThat(stages.get(3).get("$sort", Document.class))
                .containsExactly(Map.entry(RANK_FIELD, order), Map.entry("_id", order));
        verify(mongoTemplate, never()).findOne(any(Query.class), eq(Machine.class));
        verify(mongoTemplate, never()).findById(any(Object.class), eq(Machine.class));
    }

    @ParameterizedTest
    @CsvSource({
            "ONLINE, DESC, 1",
            "OFFLINE, ASC, 0",
            ", DESC, 0"
    })
    void keysetCursor_connectivitySort_carriesTheRankAtIssueTime(
            TelemetryStatus telemetryStatus, String direction, String rank) {
        // setup
        Machine machine = new Machine();
        machine.setId(CURSOR_HEX);
        machine.setTelemetryStatus(telemetryStatus);
        Sort.Direction sortDirection = Sort.Direction.valueOf(direction);

        // execution
        KeysetCursor cursor = repository.keysetCursor(machine, CONNECTIVITY, direction);

        // verifications
        assertThat(cursor).isEqualTo(new KeysetCursor(CONNECTIVITY, sortDirection, rank, CURSOR_HEX));
    }

    @Test
    void connectivityRank_onlineIsOneEverythingElseZero() {
        // verifications
        assertThat(CustomMachineRepositoryImpl.connectivityRank(TelemetryStatus.ONLINE)).isEqualTo(1);
        assertThat(CustomMachineRepositoryImpl.connectivityRank(TelemetryStatus.OFFLINE)).isZero();
        assertThat(CustomMachineRepositoryImpl.connectivityRank(null)).isZero();
    }

    @Test
    void availableForSchedule_bucketReadsTelemetryStatusNotStatus() {
        // setup
        stubAggregate(List.of());

        // execution
        repository.findAvailableForScheduleWithCursor(TENANT_ID, filter(), null, List.of("m-1"), NO_POSITION, false, 10);

        // verifications
        Document bucket = capturedStages().get(1).get("$addFields", Document.class).get("_availableBucket", Document.class);
        Document assignedRank = new Document("$cond", List.of(new Document("$in", List.of("$machineId", List.of("m-1"))), 0, 2));
        Document onlineRank = new Document("$cond", List.of(new Document("$eq", List.of("$telemetryStatus", "ONLINE")), 0, 1));
        assertThat(bucket).isEqualTo(new Document("$add", List.of(assignedRank, onlineRank)));
    }

    private static Stream<Arguments> rankKeysetsInEachFetchDirection() {
        KeysetCursor ascending = new KeysetCursor(CONNECTIVITY, Sort.Direction.ASC, "1", CURSOR_HEX);
        KeysetCursor descending = new KeysetCursor(CONNECTIVITY, Sort.Direction.DESC, "1", CURSOR_HEX);
        return Stream.of(
                arguments(ascending, false, "$gt", 1),
                arguments(ascending, true, "$lt", -1),
                arguments(descending, false, "$lt", -1),
                arguments(descending, true, "$gt", 1));
    }

    private static CursorPosition rowId(ObjectId id) {
        return new CursorPosition.RowId(id.toHexString());
    }

    private static MachineQueryFilter filter() {
        return MachineQueryFilter.builder().build();
    }

    private static List<Document> andClauses(Document query) {
        return query.getList("$and", Document.class);
    }

    private void stubCursorDocument(ObjectId cursorId, TelemetryStatus telemetryStatus) {
        Machine cursorDoc = new Machine();
        cursorDoc.setId(cursorId.toHexString());
        cursorDoc.setTelemetryStatus(telemetryStatus);
        when(mongoTemplate.findOne(any(Query.class), eq(Machine.class))).thenReturn(cursorDoc);
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
