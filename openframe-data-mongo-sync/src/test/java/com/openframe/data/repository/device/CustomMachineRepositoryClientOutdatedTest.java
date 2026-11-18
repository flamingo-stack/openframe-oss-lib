package com.openframe.data.repository.device;

import com.openframe.data.config.ClientVersionThreshold;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
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
import org.mockito.Spy;
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
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomMachineRepositoryClientOutdatedTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String CLIENT_OUTDATED = "clientOutdated";
    private static final String AGENT_VERSION_KEY = "agentVersionKey";
    private static final String RANK_FIELD = "_clientOutdatedRank";
    private static final long THRESHOLD_KEY = 1_000_006_000_000L;
    private static final long OUTDATED_KEY = 1_000_005_000_009L;
    private static final Document OUTDATED = new Document(AGENT_VERSION_KEY, new Document("$lt", THRESHOLD_KEY));
    private static final Document NOT_OUTDATED = new Document("$or", List.of(
            new Document(AGENT_VERSION_KEY, new Document("$gte", THRESHOLD_KEY)),
            new Document(AGENT_VERSION_KEY, null)));
    private static final Document OUTDATED_RANK = new Document("$cond", List.of(
            new Document("$and", List.of(
                    new Document("$isNumber", "$agentVersionKey"),
                    new Document("$lt", List.of("$agentVersionKey", THRESHOLD_KEY)))),
            1, 0));

    @Mock private MongoTemplate mongoTemplate;
    @Spy private ClientVersionThreshold clientVersionThreshold = new ClientVersionThreshold("1.6.0");
    @Captor private ArgumentCaptor<Aggregation> aggregationCaptor;
    @Captor private ArgumentCaptor<Query> queryCaptor;
    @InjectMocks private CustomMachineRepositoryImpl repository;

    @Test
    void buildDeviceQuery_clientOutdatedTrue_matchesKeysBelowThreshold() {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().clientOutdated(true).build();

        // execution
        Document query = repository.buildDeviceQuery(filter, null).getQueryObject();

        // verifications
        assertThat(andClauses(query)).contains(OUTDATED);
    }

    @Test
    void buildDeviceQuery_clientOutdatedFalse_matchesSupportedAndUnknownKeys() {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().clientOutdated(false).build();

        // execution
        Document query = repository.buildDeviceQuery(filter, null).getQueryObject();

        // verifications
        assertThat(andClauses(query)).contains(NOT_OUTDATED);
    }

    @Test
    void buildDeviceQuery_clientOutdatedNull_addsNoVersionClause() {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().build();

        // execution
        Document query = repository.buildDeviceQuery(filter, null).getQueryObject();

        // verifications
        assertThat(andClauses(query))
                .noneMatch(clause -> clause.containsKey(AGENT_VERSION_KEY))
                .noneMatch(clause -> clause.containsKey("$or"));
    }

    @Test
    void buildDeviceQuery_clientOutdatedFilter_keepsDeletedGuard() {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().clientOutdated(true).build();

        // execution
        Document query = repository.buildDeviceQuery(filter, null).getQueryObject();

        // verifications
        assertThat(andClauses(query)).contains(new Document("status", new Document("$ne", DeviceStatus.DELETED)));
    }

    @Test
    void buildDeviceQuery_clientOutdatedExcluded_dropsTheVersionArmOnly() {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder()
                .clientOutdated(true).connectivity(List.of("ONLINE")).build();

        // execution
        Document query = repository.buildDeviceQuery(filter, null, AGENT_VERSION_KEY).getQueryObject();

        // verifications
        assertThat(andClauses(query))
                .doesNotContain(OUTDATED)
                .contains(new Document("telemetryStatus", new Document("$in", List.of("ONLINE"))));
    }

    @Test
    void facet_clientOutdated_countsBothSidesUnderTheOtherFilters() {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder()
                .clientOutdated(true).connectivity(List.of("ONLINE")).build();
        when(mongoTemplate.count(any(Query.class), eq(Machine.class))).thenReturn(3L, 7L);

        // execution
        Map<String, Integer> counts = repository.facet(TENANT_ID, filter, null, DeviceFacetDimension.CLIENT_OUTDATED);

        // verifications
        assertThat(counts).containsExactly(Map.entry("true", 3), Map.entry("false", 7));
        verify(mongoTemplate, times(2)).count(queryCaptor.capture(), eq(Machine.class));
        List<Document> outdatedQuery = queryCaptor.getAllValues().getFirst().getQueryObject().getList("$and", Document.class);
        List<Document> notOutdatedQuery = queryCaptor.getAllValues().getLast().getQueryObject().getList("$and", Document.class);
        assertThat(outdatedQuery.getLast()).isEqualTo(OUTDATED);
        assertThat(notOutdatedQuery.getLast()).isEqualTo(NOT_OUTDATED);
    }

    @Test
    void facet_clientOutdated_baseQueryIsTenantScopedWithoutTheVersionArm() {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder()
                .clientOutdated(true).connectivity(List.of("ONLINE")).build();
        when(mongoTemplate.count(any(Query.class), eq(Machine.class))).thenReturn(0L, 0L);

        // execution
        repository.facet(TENANT_ID, filter, null, DeviceFacetDimension.CLIENT_OUTDATED);

        // verifications
        verify(mongoTemplate, times(2)).count(queryCaptor.capture(), eq(Machine.class));
        Document base = queryCaptor.getValue().getQueryObject().getList("$and", Document.class).getFirst();
        assertThat(base).containsEntry("tenantId", TENANT_ID);
        assertThat(andClauses(base))
                .doesNotContain(OUTDATED)
                .contains(new Document("telemetryStatus", new Document("$in", List.of("ONLINE"))));
    }

    @Test
    void facet_clientOutdatedNoDevices_listsBothBucketsWithZero() {
        // setup
        when(mongoTemplate.count(any(Query.class), eq(Machine.class))).thenReturn(0L, 0L);

        // execution
        Map<String, Integer> counts = repository.facet(TENANT_ID, filter(), null, DeviceFacetDimension.CLIENT_OUTDATED);

        // verifications
        assertThat(counts).containsExactly(Map.entry("true", 0), Map.entry("false", 0));
        verify(mongoTemplate, never()).aggregate(any(Aggregation.class), eq(Machine.class), eq(Document.class));
    }

    @Test
    void isSortableField_clientOutdated_isSortable() {
        // execution
        boolean sortable = repository.isSortableField(CLIENT_OUTDATED);

        // verifications
        assertThat(sortable).isTrue();
    }

    @Test
    void clientOutdatedDesc_ranksOutdatedFirst() {
        // setup
        stubAggregate();

        // execution
        repository.findMachinesWithCursor(TENANT_ID, filter(), null, null, 10, CLIENT_OUTDATED, "DESC");

        // verifications
        List<Document> stages = capturedStages();
        assertThat(stages).hasSize(4);
        assertThat(stages.getFirst().get("$match", Document.class)).containsEntry("tenantId", TENANT_ID);
        assertThat(stages.get(1).get("$addFields", Document.class)).containsEntry(RANK_FIELD, OUTDATED_RANK);
        assertThat(stages.get(2).get("$sort", Document.class))
                .containsExactly(Map.entry(RANK_FIELD, -1), Map.entry("_id", -1));
        assertThat(stages.get(3)).containsEntry("$limit", 10L);
        verify(mongoTemplate, never()).find(any(Query.class), eq(Machine.class));
    }

    @Test
    void clientOutdatedAsc_ranksSupportedFirst() {
        // setup
        stubAggregate();

        // execution
        repository.findMachinesWithCursor(TENANT_ID, filter(), null, null, 5, CLIENT_OUTDATED, "ASC");

        // verifications
        assertThat(capturedStages().get(2).get("$sort", Document.class))
                .containsExactly(Map.entry(RANK_FIELD, 1), Map.entry("_id", 1));
    }

    @Test
    void clientOutdatedDescCursor_outdatedCursorKeysetOverRankAndId() {
        // setup
        ObjectId cursorId = new ObjectId();
        stubCursorDocument(cursorId, OUTDATED_KEY);
        stubAggregate();

        // execution
        repository.findMachinesWithCursor(TENANT_ID, filter(), null, cursorId.toHexString(), 10, CLIENT_OUTDATED, "DESC");

        // verifications
        List<Document> stages = capturedStages();
        assertThat(stages).hasSize(5);
        List<Document> branches = stages.get(2).get("$match", Document.class).getList("$or", Document.class);
        assertThat(branches).containsExactly(
                new Document(RANK_FIELD, new Document("$lt", 1)),
                new Document(RANK_FIELD, 1).append("_id", new Document("$lt", cursorId)));
    }

    @Test
    void clientOutdatedAscCursor_unknownVersionRanksAsNotOutdated() {
        // setup
        ObjectId cursorId = new ObjectId();
        stubCursorDocument(cursorId, null);
        stubAggregate();

        // execution
        repository.findMachinesWithCursor(TENANT_ID, filter(), null, cursorId.toHexString(), 10, CLIENT_OUTDATED, "ASC");

        // verifications
        List<Document> branches = capturedStages().get(2).get("$match", Document.class).getList("$or", Document.class);
        assertThat(branches).containsExactly(
                new Document(RANK_FIELD, new Document("$gt", 0)),
                new Document(RANK_FIELD, 0).append("_id", new Document("$gt", cursorId)));
    }

    @Test
    void clientOutdatedDescCursor_thresholdVersionRanksAsNotOutdated() {
        // setup
        ObjectId cursorId = new ObjectId();
        stubCursorDocument(cursorId, THRESHOLD_KEY);
        stubAggregate();

        // execution
        repository.findMachinesWithCursor(TENANT_ID, filter(), null, cursorId.toHexString(), 10, CLIENT_OUTDATED, "DESC");

        // verifications
        List<Document> branches = capturedStages().get(2).get("$match", Document.class).getList("$or", Document.class);
        assertThat(branches).containsExactly(
                new Document(RANK_FIELD, new Document("$lt", 0)),
                new Document(RANK_FIELD, 0).append("_id", new Document("$lt", cursorId)));
    }

    private static MachineQueryFilter filter() {
        return MachineQueryFilter.builder().build();
    }

    private static List<Document> andClauses(Document query) {
        return query.getList("$and", Document.class);
    }

    private void stubCursorDocument(ObjectId cursorId, Long agentVersionKey) {
        Machine cursorDoc = new Machine();
        cursorDoc.setId(cursorId.toHexString());
        cursorDoc.setAgentVersionKey(agentVersionKey);
        when(mongoTemplate.findById(cursorId, Machine.class)).thenReturn(cursorDoc);
    }

    private void stubAggregate() {
        List<Document> rows = List.of();
        AggregationResults<Document> results = new AggregationResults<>(rows, new Document());
        when(mongoTemplate.aggregate(any(Aggregation.class), eq(Machine.class), eq(Document.class))).thenReturn(results);
    }

    private List<Document> capturedStages() {
        verify(mongoTemplate).aggregate(aggregationCaptor.capture(), eq(Machine.class), eq(Document.class));
        return aggregationCaptor.getValue().toPipeline(Aggregation.DEFAULT_CONTEXT);
    }
}
