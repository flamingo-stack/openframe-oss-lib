package com.openframe.data.repository.device;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.TelemetryStatus;
import com.openframe.data.document.device.filter.DeviceFacetDimension;
import com.openframe.data.document.device.filter.MachineQueryFilter;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
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
class CustomMachineRepositoryConnectivityTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String CONNECTIVITY = "connectivity";
    private static final String TELEMETRY_STATUS = "telemetryStatus";
    private static final String RANK_FIELD = "_connectivityRank";
    private static final Document ONLINE_RANK = new Document("$cond",
            List.of(new Document("$eq", List.of("$telemetryStatus", "ONLINE")), 1, 0));

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
                .connectivity(List.of("ONLINE")).statuses(List.of("MANAGED", "PENDING")).build();

        // execution
        Document query = repository.buildDeviceQuery(filter, null, TELEMETRY_STATUS).getQueryObject();

        // verifications
        assertThat(andClauses(query))
                .noneMatch(clause -> clause.containsKey(TELEMETRY_STATUS))
                .contains(new Document("status", new Document("$in", List.of("MANAGED", "PENDING"))));
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
        repository.findMachinesWithCursor(TENANT_ID, filter(), null, null, 10, CONNECTIVITY, "DESC");

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
        repository.findMachinesWithCursor(TENANT_ID, filter(), null, null, 5, CONNECTIVITY, "ASC");

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
        repository.findMachinesWithCursor(TENANT_ID, filter(), null, cursorId.toHexString(), 10, CONNECTIVITY, "DESC");

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
        repository.findMachinesWithCursor(TENANT_ID, filter(), null, cursorId.toHexString(), 10, CONNECTIVITY, "ASC");

        // verifications
        List<Document> branches = capturedStages().get(2).get("$match", Document.class).getList("$or", Document.class);
        assertThat(branches).containsExactly(
                new Document(RANK_FIELD, new Document("$gt", 0)),
                new Document(RANK_FIELD, 0).append("_id", new Document("$gt", cursorId)));
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
        repository.findAvailableForScheduleWithCursor(TENANT_ID, filter(), null, List.of("m-1"), null, 10);

        // verifications
        Document bucket = capturedStages().get(1).get("$addFields", Document.class).get("_availableBucket", Document.class);
        Document assignedRank = new Document("$cond", List.of(new Document("$in", List.of("$machineId", List.of("m-1"))), 0, 2));
        Document onlineRank = new Document("$cond", List.of(new Document("$eq", List.of("$telemetryStatus", "ONLINE")), 0, 1));
        assertThat(bucket).isEqualTo(new Document("$add", List.of(assignedRank, onlineRank)));
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
