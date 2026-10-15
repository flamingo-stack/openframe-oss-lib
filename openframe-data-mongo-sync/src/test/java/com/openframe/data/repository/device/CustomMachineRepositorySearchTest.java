package com.openframe.data.repository.device;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.filter.MachineQueryFilter;
import com.openframe.data.document.tag.Tag;
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
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.IntStream;
import java.util.stream.Stream;

import static com.openframe.data.document.rmm.script.OsType.WINDOWS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomMachineRepositorySearchTest {

    private static final String TENANT_ID = "tenant-1";

    @Mock private MongoTemplate mongoTemplate;
    @Captor private ArgumentCaptor<Query> queryCaptor;
    @InjectMocks private CustomMachineRepositoryImpl repository;

    @Test
    void buildDeviceQuery_exactHostnames_addsLiteralHostnameSelector() {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().hostnames(List.of("TADC01")).build();

        // execution
        Query query = repository.buildDeviceQuery(filter, "");

        // verifications
        Pattern regex = nameRegex(query, "hostname");
        assertThat(regex.matcher("tadc01").matches()).isTrue();
        assertThat(regex.matcher("Dev-TADC01").find()).isFalse();
        assertThat(regex.matcher("TADC01-extra").find()).isFalse();
        assertThat(regex.matcher("TADC01\n").find()).isFalse();
    }

    @Test
    void findMachines_exactHostnames_treatsMetacharactersLiterally() {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder()
                .hostnames(List.of("web.*", "db?(01)", "node|other")).build();

        // execution
        repository.findMachines(TENANT_ID, filter);

        // verifications
        Query query = machineQuery();
        Pattern regex = nameRegex(query, "hostname");
        assertThat(regex.matcher("web.*").matches()).isTrue();
        assertThat(regex.matcher("db?(01)").matches()).isTrue();
        assertThat(regex.matcher("node|other").matches()).isTrue();
        assertThat(regex.matcher("web-prod").matches()).isFalse();
        assertThat(regex.matcher("db01").matches()).isFalse();
        assertThat(regex.matcher("node").matches()).isFalse();
        assertThat(clauses(query.getQueryObject())).noneMatch(clause -> clause.containsKey("nickname"));
    }

    @Test
    void findMachines_fiftySevenHostnames_usesOneTenantScopedInventoryQuery() {
        // setup
        List<String> hostnames = IntStream.rangeClosed(1, 57).mapToObj(index -> "host-" + index).toList();
        MachineQueryFilter filter = MachineQueryFilter.builder().hostnames(hostnames).build();

        // execution
        repository.findMachines(TENANT_ID, filter);

        // verifications
        Query query = machineQuery();
        assertThat(query.getQueryObject()).containsEntry("tenantId", TENANT_ID);
        Pattern regex = nameRegex(query, "hostname");
        assertThat(regex.matcher("host-1").matches()).isTrue();
        assertThat(regex.matcher("HOST-57").matches()).isTrue();
        assertThat(regex.matcher("host-58").matches()).isFalse();
    }

    @Test
    void findMachines_exactNicknames_matchesNicknameOrDisplayNameLiterally() {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder()
                .nicknames(List.of("Office.*", "Reception Mac")).build();

        // execution
        repository.findMachines(TENANT_ID, filter);

        // verifications
        Query query = machineQuery();
        Pattern nickname = nameRegex(query, "nickname");
        Pattern displayName = nameRegex(query, "displayName");
        assertThat(nickname.matcher("OFFICE.*").matches()).isTrue();
        assertThat(nickname.matcher("Office Mac").matches()).isFalse();
        assertThat(displayName.matcher("RECEPTION MAC").matches()).isTrue();
        assertThat(displayName.matcher("Dev-Reception Mac").find()).isFalse();
        assertThat(clauses(query.getQueryObject())).noneMatch(clause -> clause.containsKey("hostname"));
    }

    @Test
    void findMachines_bothExactLists_combinesSeparateNameFieldsWithOr() {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder()
                .hostnames(List.of("TADC01")).nicknames(List.of("Office Mac")).build();

        // execution
        repository.findMachines(TENANT_ID, filter);

        // verifications
        Query query = machineQuery();
        assertThat(clauses(query.getQueryObject())).anySatisfy(clause ->
                assertThat(clause.getList("$or", Document.class)).hasSize(3));
        assertThat(nameRegex(query, "hostname").matcher("tadc01").matches()).isTrue();
        assertThat(nameRegex(query, "nickname").matcher("OFFICE MAC").matches()).isTrue();
        assertThat(nameRegex(query, "displayName").matcher("OFFICE MAC").matches()).isTrue();
        assertThat(nameRegex(query, "hostname").matcher("Office Mac").matches()).isFalse();
        assertThat(nameRegex(query, "nickname").matcher("TADC01").matches()).isFalse();
        assertThat(nameRegex(query, "displayName").matcher("TADC01").matches()).isFalse();
    }

    @ParameterizedTest
    @NullAndEmptySource
    void findMachines_noExactLists_preservesPatternSearch(List<String> names) {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder()
                .hostnames(names).nicknames(names).pattern("Laptop").build();

        // execution
        repository.findMachines(TENANT_ID, filter);

        // verifications
        Query query = machineQuery();
        assertThat(nameRegex(query, "hostname").matcher("laptop-042").find()).isTrue();
        assertThat(nameRegex(query, "nickname").matcher("Anna's Laptop").find()).isTrue();
        assertThat(nameRegex(query, "displayName").matcher("Reception Laptop").find()).isTrue();
    }

    @Test
    void findMachines_wildcardPattern_preservesWholeNameMatching() {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().pattern("web-?*").build();

        // execution
        repository.findMachines(TENANT_ID, filter);

        // verifications
        Query query = machineQuery();
        Pattern regex = nameRegex(query, "hostname");
        assertThat(regex.matcher("WEB-prod").find()).isTrue();
        assertThat(regex.matcher("web-").find()).isFalse();
        assertThat(regex.matcher("dev-web-prod").find()).isFalse();
    }

    @Test
    void findMachines_noNameSelector_preservesCallerActiveStatusPolicy() {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().statuses(List.of("ONLINE", "OFFLINE")).build();

        // execution
        repository.findMachines(TENANT_ID, filter);

        // verifications
        Query query = machineQuery();
        Document status = clauseFor(query, "status");
        assertThat(status).containsEntry("status", new Document("$in", List.of("ONLINE", "OFFLINE")));
        assertThat(clauses(query.getQueryObject())).noneMatch(clause -> clause.containsKey("hostname"));
    }

    @Test
    void findMachines_exactNames_combinesStatusOsOrganizationAndTagFilters() {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder()
                .hostnames(List.of("TADC01")).nicknames(List.of("Office Mac"))
                .statuses(List.of("ONLINE")).osTypes(List.of(WINDOWS)).organizationIds(List.of("organization-1"))
                .tagValues(List.of("production")).build();
        TagAssignment assignment = tagAssignment("machine-1");
        when(mongoTemplate.find(any(Query.class), eq(TagAssignment.class))).thenReturn(List.of(assignment));

        // execution
        repository.findMachines(TENANT_ID, filter);

        // verifications
        Query query = machineQuery();
        assertThat(clauseFor(query, "status")).containsEntry("status", new Document("$in", List.of("ONLINE")));
        assertThat(clauseFor(query, "osType")).containsEntry("osType", new Document("$in", List.of(WINDOWS)));
        assertThat(clauseFor(query, "organizationId"))
                .containsEntry("organizationId", new Document("$in", List.of("organization-1")));
        assertThat(clauseFor(query, "machineId"))
                .containsEntry("machineId", new Document("$in", List.of("machine-1")));
        verify(mongoTemplate).find(queryCaptor.capture(), eq(TagAssignment.class));
        assertThat(queryCaptor.getValue().getQueryObject())
                .containsEntry("tenantId", TENANT_ID)
                .containsEntry("entityType", TagEntityType.DEVICE)
                .containsEntry("values", new Document("$in", List.of("production")));
    }

    @Test
    void findMachines_noMatchingTagKeys_restrictsToEmptyMachineSet() {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().tagKeys(List.of("environment")).build();

        // execution
        repository.findMachines(TENANT_ID, filter);

        // verifications
        Query query = machineQuery();
        assertThat(clauseFor(query, "machineId")).containsEntry("machineId", new Document("$in", List.of()));
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Tag.class));
        assertThat(queryCaptor.getValue().getQueryObject())
                .containsEntry("tenantId", TENANT_ID)
                .containsEntry("entityType", TagEntityType.DEVICE)
                .containsEntry("key", new Document("$in", List.of("environment")));
    }

    @Test
    void findMachines_tagKeys_fencesTagsAndAssignmentsAndDeduplicatesMachineIds() {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().tagKeys(List.of("environment")).build();
        Tag tag = Tag.builder().id("tag-1").build();
        TagAssignment assignment = tagAssignment("machine-1");
        when(mongoTemplate.find(any(Query.class), eq(Tag.class))).thenReturn(List.of(tag));
        when(mongoTemplate.find(any(Query.class), eq(TagAssignment.class))).thenReturn(List.of(assignment, assignment));

        // execution
        repository.findMachines(TENANT_ID, filter);

        // verifications
        Query query = machineQuery();
        assertThat(query.getQueryObject()).containsEntry("tenantId", TENANT_ID);
        assertThat(clauseFor(query, "machineId"))
                .containsEntry("machineId", new Document("$in", List.of("machine-1")));
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Tag.class));
        assertThat(queryCaptor.getValue().getQueryObject())
                .containsEntry("tenantId", TENANT_ID).containsEntry("entityType", TagEntityType.DEVICE);
        verify(mongoTemplate).find(queryCaptor.capture(), eq(TagAssignment.class));
        assertThat(queryCaptor.getValue().getQueryObject())
                .containsEntry("tenantId", TENANT_ID).containsEntry("entityType", TagEntityType.DEVICE)
                .containsEntry("tagId", new Document("$in", List.of("tag-1")));
    }

    @Test
    void findMachines_tagKeysAndValues_requiresValueOnSelectedTag() {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder()
                .nicknames(List.of("Office Mac")).tagKeys(List.of("environment"))
                .tagValues(List.of("production")).build();
        Tag tag = Tag.builder().id("tag-1").build();
        TagAssignment assignment = tagAssignment("machine-1");
        when(mongoTemplate.find(any(Query.class), eq(Tag.class))).thenReturn(List.of(tag));
        when(mongoTemplate.find(any(Query.class), eq(TagAssignment.class))).thenReturn(List.of(assignment));

        // execution
        repository.findMachines(TENANT_ID, filter);

        // verifications
        Query query = machineQuery();
        assertThat(nameRegex(query, "displayName").matcher("Office Mac").matches()).isTrue();
        verify(mongoTemplate).find(queryCaptor.capture(), eq(TagAssignment.class));
        assertThat(queryCaptor.getValue().getQueryObject())
                .containsEntry("tenantId", TENANT_ID).containsEntry("entityType", TagEntityType.DEVICE)
                .containsEntry("tagId", new Document("$in", List.of("tag-1")))
                .containsEntry("values", new Document("$in", List.of("production")));
    }

    @Test
    void findMachines_existingMachineRestriction_intersectsTagRestriction() {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder()
                .restrictToMachineIds(List.of("machine-2")).tagValues(List.of("production")).build();
        TagAssignment assignment = tagAssignment("machine-1");
        when(mongoTemplate.find(any(Query.class), eq(TagAssignment.class))).thenReturn(List.of(assignment));

        // execution
        repository.findMachines(TENANT_ID, filter);

        // verifications
        Query query = machineQuery();
        assertThat(clauses(query.getQueryObject()).filter(clause -> clause.containsKey("machineId")))
                .extracting(clause -> clause.get("machineId"))
                .containsExactlyInAnyOrder(new Document("$in", List.of("machine-1")),
                        new Document("$in", List.of("machine-2")));
    }

    @Test
    void countMachines_tagValues_usesSameScopedTagRestriction() {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().tagValues(List.of("production")).build();

        // execution
        repository.countMachines(TENANT_ID, filter, "");

        // verifications
        verify(mongoTemplate).count(queryCaptor.capture(), eq(Machine.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject()).containsEntry("tenantId", TENANT_ID);
        assertThat(clauseFor(query, "machineId")).containsEntry("machineId", new Document("$in", List.of()));
        verify(mongoTemplate).find(queryCaptor.capture(), eq(TagAssignment.class));
        assertThat(queryCaptor.getValue().getQueryObject()).containsEntry("tenantId", TENANT_ID);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " ", "\t"})
    void findMachines_missingTenant_rejectsBeforeReadingAnyCollection(String tenantId) {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().tagValues(List.of("production")).build();

        // execution
        Throwable execution = catchThrowable(() -> repository.findMachines(tenantId, filter));

        // verifications
        assertThat(execution).isInstanceOf(IllegalArgumentException.class).hasMessage("tenantId must not be blank");
        verifyNoInteractions(mongoTemplate);
    }

    @ParameterizedTest
    @ValueSource(strings = {"(a+)+$", "web-*", "db?prod"})
    void buildDeviceQuery_dashboardSearch_keepsLiteralSubstringAcrossSevenFields(String search) {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().build();

        // execution
        Query query = repository.buildDeviceQuery(filter, search);

        // verifications
        assertThat(clauses(query.getQueryObject()).filter(clause -> clause.values().stream().anyMatch(Pattern.class::isInstance)))
                .flatExtracting(Document::keySet)
                .containsExactlyInAnyOrder("hostname", "nickname", "displayName", "ip", "serialNumber", "manufacturer", "model");
        assertThat(nameRegex(query, "hostname").matcher("prefix-" + search + "-suffix").find()).isTrue();
        assertThat(nameRegex(query, "hostname").matcher("web-prod").find()).isFalse();
    }

    @Test
    void machineQueryFilter_legacyConstructor_preservesExistingArguments() {
        // setup
        List<String> statuses = List.of("ONLINE");
        List<String> hidden = List.of("DELETED");
        List<String> types = List.of("LAPTOP");
        List<String> organizations = List.of("organization-1");
        List<String> machineIds = List.of("machine-1");

        // execution
        MachineQueryFilter filter = new MachineQueryFilter(statuses, hidden, types, List.of(WINDOWS),
                organizations, machineIds, List.of());

        // verifications
        assertThat(filter.getStatuses()).containsExactly("ONLINE");
        assertThat(filter.getExcludeStatuses()).containsExactly("DELETED");
        assertThat(filter.getDeviceTypes()).containsExactly("LAPTOP");
        assertThat(filter.getOsTypes()).containsExactly(WINDOWS);
        assertThat(filter.getOrganizationIds()).containsExactly("organization-1");
        assertThat(filter.getRestrictToMachineIds()).containsExactly("machine-1");
        assertThat(filter.getPattern()).isNull();
        assertThat(filter.getHostnames()).isNull();
        assertThat(filter.getNicknames()).isNull();
        assertThat(filter.getTagKeys()).isNull();
        assertThat(filter.getTagValues()).isNull();
    }

    private TagAssignment tagAssignment(String machineId) {
        return TagAssignment.builder().entityId(machineId).build();
    }

    private Query machineQuery() {
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Machine.class));
        return queryCaptor.getValue();
    }

    private Document clauseFor(Query query, String field) {
        Document predicate = query.getQueryObject();
        return clauses(predicate).filter(clause -> clause.containsKey(field)).findFirst().orElseThrow();
    }

    private Pattern nameRegex(Query query, String field) {
        Document criterion = clauseFor(query, field);
        return criterion.get(field, Pattern.class);
    }

    private Stream<Document> clauses(Document predicate) {
        Stream<Document> self = Stream.of(predicate);
        Stream<Document> children = predicate.values().stream().flatMap(this::childClauses);
        return Stream.concat(self, children);
    }

    private Stream<Document> childClauses(Object value) {
        if (value instanceof List<?> children) {
            return children.stream().filter(Document.class::isInstance).map(Document.class::cast).flatMap(this::clauses);
        }
        return Stream.empty();
    }
}
