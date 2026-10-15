package com.openframe.data.repository.device;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.filter.MachineQueryFilter;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
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
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomMachineRepositoryPagingTest {

    private static final String TENANT_ID = "tenant-1";

    @Mock private MongoTemplate mongoTemplate;
    @Captor private ArgumentCaptor<Query> queryCaptor;
    @Captor private ArgumentCaptor<Aggregation> aggregationCaptor;
    @InjectMocks private CustomMachineRepositoryImpl repository;

    @Test
    void findMachinesAfter_pageRequest_limitsInventoryQuery() {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().build();

        // execution
        repository.findMachinesAfter(TENANT_ID, filter, "", 51);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Machine.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getLimit()).isEqualTo(51);
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document("machineId", 1));
        assertThat(query.getQueryObject()).containsEntry("tenantId", TENANT_ID);
    }

    @Test
    void findMachinesAfter_cursorAndTags_intersectsTagAndExistingMachineRestrictions() {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().restrictToMachineIds(List.of("machine-057"))
                .tagValues(List.of("production")).build();
        TagAssignment assignment = TagAssignment.builder().entityId("machine-057").build();
        when(mongoTemplate.find(any(Query.class), eq(TagAssignment.class))).thenReturn(List.of(assignment));

        // execution
        repository.findMachinesAfter(TENANT_ID, filter, "machine-050", 51);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Machine.class));
        Query query = queryCaptor.getValue();
        List<Document> predicates = query.getQueryObject().getList("$and", Document.class);
        assertThat(predicates).hasSize(2).contains(new Document("machineId", new Document("$gt", "machine-050")));
        assertThat(predicates).anySatisfy(predicate -> assertThat(predicate)
                .containsEntry("tenantId", TENANT_ID)
                .containsEntry("machineId", new Document("$in", List.of("machine-057"))));
        assertThat(query.getLimit()).isEqualTo(51);
        assertThat(query.getSortObject()).containsEntry("machineId", 1);
        verify(mongoTemplate).find(queryCaptor.capture(), eq(TagAssignment.class));
        assertThat(queryCaptor.getValue().getQueryObject())
                .containsEntry("tenantId", TENANT_ID).containsEntry("entityType", TagEntityType.DEVICE);
    }

    @ParameterizedTest
    @ValueSource(ints = {0, -1})
    void findMachinesAfter_nonpositiveLimit_rejectsBeforeDatabaseReads(int limit) {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().tagValues(List.of("production")).build();

        // execution
        Throwable error = catchThrowable(() -> repository.findMachinesAfter(TENANT_ID, filter, "", limit));

        // verifications
        assertThat(error).isInstanceOf(IllegalArgumentException.class).hasMessage("limit must be positive");
        verifyNoInteractions(mongoTemplate);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void findMachinesAfter_missingTenant_rejectsBeforeDatabaseReads(String tenantId) {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().tagValues(List.of("production")).build();

        // execution
        Throwable error = catchThrowable(() -> repository.findMachinesAfter(tenantId, filter, "", 51));

        // verifications
        assertThat(error).isInstanceOf(IllegalArgumentException.class).hasMessage("tenantId must not be blank");
        verifyNoInteractions(mongoTemplate);
    }

    @Test
    void findMatchingNames_matchedFlags_returnsRequestedNamesInOriginalOrder() {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder()
                .hostnames(List.of("TADC01", "missing-host", "node-Σ"))
                .nicknames(List.of("missing-display", "Office Mac")).build();
        Document flags = new Document("h0", true).append("h1", false).append("h2", true)
                .append("n0", false).append("n1", true);
        stubPresence(flags);

        // execution
        MachineNameMatches matches = repository.findMatchingNames(TENANT_ID, filter);

        // verifications
        assertThat(matches.getHostnames()).containsExactly("TADC01", "node-Σ");
        assertThat(matches.getNicknames()).containsExactly("Office Mac");
        verify(mongoTemplate).aggregate(aggregationCaptor.capture(), eq(Machine.class), eq(Document.class));
        List<Document> stages = aggregationCaptor.getValue().toPipeline(Aggregation.DEFAULT_CONTEXT);
        assertThat(stages).hasSize(2);
        assertThat(stages.getFirst()).containsOnlyKeys("$match");
        assertThat(stages.getLast().get("$group", Document.class))
                .containsOnlyKeys("_id", "h0", "h1", "h2", "n0", "n1");
    }

    @Test
    void findMatchingNames_nameAfterFirstPage_checksAllRequestedNamesWithoutPageLimit() {
        // setup
        List<String> hostnames = IntStream.rangeClosed(1, 57).mapToObj(index -> "host-" + index).toList();
        MachineQueryFilter filter = MachineQueryFilter.builder().hostnames(hostnames).build();
        stubPresence(new Document("h56", true));

        // execution
        MachineNameMatches matches = repository.findMatchingNames(TENANT_ID, filter);

        // verifications
        assertThat(matches.getHostnames()).containsExactly("host-57");
        assertThat(matches.getNicknames()).isEmpty();
        verify(mongoTemplate).aggregate(aggregationCaptor.capture(), eq(Machine.class), eq(Document.class));
        List<Document> stages = aggregationCaptor.getValue().toPipeline(Aggregation.DEFAULT_CONTEXT);
        assertThat(stages).hasSize(2).noneMatch(stage -> stage.containsKey("$limit"));
        assertThat(stages.getLast().get("$group", Document.class)).hasSize(58);
    }

    @Test
    void findMatchingNames_specialNames_usesLiteralRegexAndIndexedFlagKeys() {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder()
                .hostnames(List.of("$host.with.*")).nicknames(List.of("Office Mac")).build();
        stubPresence(new Document("h0", true).append("n0", true));

        // execution
        MachineNameMatches matches = repository.findMatchingNames(TENANT_ID, filter);

        // verifications
        assertThat(matches.getHostnames()).containsExactly("$host.with.*");
        assertThat(matches.getNicknames()).containsExactly("Office Mac");
        verify(mongoTemplate).aggregate(aggregationCaptor.capture(), eq(Machine.class), eq(Document.class));
        List<Document> stages = aggregationCaptor.getValue().toPipeline(Aggregation.DEFAULT_CONTEXT);
        Document group = stages.getLast().get("$group", Document.class);
        assertThat(group).containsOnlyKeys("_id", "h0", "n0");
        assertThat(regexExpressions(group, "h0"))
                .containsExactly(regexMatch("hostname", "\\A\\Q$host.with.*\\E\\z"));
        assertThat(regexExpressions(group, "n0"))
                .containsExactly(regexMatch("nickname", "\\A\\QOffice Mac\\E\\z"),
                        regexMatch("displayName", "\\A\\QOffice Mac\\E\\z"));
    }

    @Test
    void findMatchingNames_filteredNames_appliesTenantStatusOsOrganizationAndTags() {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().hostnames(List.of("host-1"))
                .statuses(List.of("ONLINE")).osTypes(List.of(com.openframe.data.document.rmm.script.OsType.WINDOWS))
                .organizationIds(List.of("organization-1")).tagValues(List.of("production")).build();
        TagAssignment assignment = TagAssignment.builder().entityId("machine-1").build();
        when(mongoTemplate.find(any(Query.class), eq(TagAssignment.class))).thenReturn(List.of(assignment));
        stubPresence(new Document("h0", true));

        // execution
        MachineNameMatches matches = repository.findMatchingNames(TENANT_ID, filter);

        // verifications
        assertThat(matches.getHostnames()).containsExactly("host-1");
        verify(mongoTemplate).aggregate(aggregationCaptor.capture(), eq(Machine.class), eq(Document.class));
        List<Document> stages = aggregationCaptor.getValue().toPipeline(Aggregation.DEFAULT_CONTEXT);
        Document predicate = stages.getFirst().get("$match", Document.class).getList("$and", Document.class).getFirst();
        assertThat(predicate).containsEntry("tenantId", TENANT_ID)
                .containsEntry("machineId", new Document("$in", List.of("machine-1")));
        assertThat(predicate.getList("$and", Document.class))
                .contains(new Document("status", new Document("$in", List.of("ONLINE"))),
                        new Document("organizationId", new Document("$in", List.of("organization-1"))));
        verify(mongoTemplate).find(queryCaptor.capture(), eq(TagAssignment.class));
        assertThat(queryCaptor.getValue().getQueryObject()).containsEntry("tenantId", TENANT_ID);
    }

    @Test
    void findMatchingNames_emptyInventory_returnsEmptyMatches() {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().hostnames(List.of("absent")).build();
        AggregationResults<Document> empty = new AggregationResults<>(List.of(), new Document());
        when(mongoTemplate.aggregate(any(Aggregation.class), eq(Machine.class), eq(Document.class))).thenReturn(empty);

        // execution
        MachineNameMatches matches = repository.findMatchingNames(TENANT_ID, filter);

        // verifications
        assertThat(matches.getHostnames()).isEmpty();
        assertThat(matches.getNicknames()).isEmpty();
    }

    @ParameterizedTest
    @NullAndEmptySource
    void findMatchingNames_noExactNames_returnsEmptyWithoutDatabaseReads(List<String> names) {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().hostnames(names).nicknames(names).pattern("web-*").build();

        // execution
        MachineNameMatches matches = repository.findMatchingNames(TENANT_ID, filter);

        // verifications
        assertThat(matches.getHostnames()).isEmpty();
        assertThat(matches.getNicknames()).isEmpty();
        verifyNoInteractions(mongoTemplate);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void findMatchingNames_missingTenant_rejectsBeforeDatabaseReads(String tenantId) {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().hostnames(List.of("host-1")).build();

        // execution
        Throwable error = catchThrowable(() -> repository.findMatchingNames(tenantId, filter));

        // verifications
        assertThat(error).isInstanceOf(IllegalArgumentException.class).hasMessage("tenantId must not be blank");
        verifyNoInteractions(mongoTemplate);
    }

    private void stubPresence(Document flags) {
        AggregationResults<Document> results = new AggregationResults<>(List.of(flags), new Document());
        when(mongoTemplate.aggregate(any(Aggregation.class), eq(Machine.class), eq(Document.class))).thenReturn(results);
    }

    private List<Document> regexExpressions(Document group, String flag) {
        return group.get(flag, Document.class).get("$max", Document.class).getList("$or", Document.class);
    }

    private Document regexMatch(String field, String regex) {
        Document input = new Document("$ifNull", List.of("$" + field, ""));
        Document arguments = new Document("input", input).append("regex", regex).append("options", "i");
        return new Document("$regexMatch", arguments);
    }
}
