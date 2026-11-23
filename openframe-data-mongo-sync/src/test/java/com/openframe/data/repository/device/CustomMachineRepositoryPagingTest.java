package com.openframe.data.repository.device;

import com.openframe.core.exception.InvalidCursorException;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.TelemetryStatus;
import com.openframe.data.document.device.filter.MachineQueryFilter;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.repository.cursor.CursorBase64;
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
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
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

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Collection;
import java.util.List;
import java.util.stream.IntStream;
import java.util.stream.Stream;

import static com.openframe.data.document.rmm.script.OsType.WINDOWS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomMachineRepositoryPagingTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String ID = "_id";
    private static final String HOSTNAME = "hostname";
    private static final String LAST_SEEN = "lastSeen";
    private static final String BUCKET = "bucket";
    private static final String BUCKET_FIELD = "_availableBucket";
    private static final String ASC = "ASC";
    private static final String DESC = "DESC";
    private static final String GREATER = "$gt";
    private static final String LESS = "$lt";
    private static final String INVALID_CURSOR = "Invalid cursor";
    private static final String CURSOR_HEX = "65f1a2b3c4d5e6f708192a3b";
    private static final ObjectId CURSOR_ID = new ObjectId(CURSOR_HEX);
    private static final String ASSIGNED_MACHINE_ID = "machine-assigned";
    private static final String CURSOR_NAME = "host-m";
    private static final Instant CURSOR_LAST_SEEN = Instant.ofEpochMilli(1_700_000_000_123L);
    private static final List<String> VALUE_SORT_FIELDS = List.of(HOSTNAME, "displayName", "nickname", LAST_SEEN);
    private static final int FETCH_LIMIT = 11;

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
                .statuses(List.of("ONLINE")).osTypes(List.of(WINDOWS))
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

    @ParameterizedTest
    @MethodSource("valueSortsInEachFetchDirection")
    void findMachinesWithCursor_valueSortWithoutPosition_sortsByFieldThenIdInFetchDirection(
            String sortField, String direction, boolean backward, int order) {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().build();
        CursorPosition noPosition = new CursorPosition.None();

        // execution
        repository.findMachinesWithCursor(TENANT_ID, filter, null, noPosition, backward, FETCH_LIMIT, sortField, direction);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Machine.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(sortField, order).append(ID, order));
        assertThat(query.getLimit()).isEqualTo(FETCH_LIMIT);
        assertThat(query.getQueryObject())
                .containsEntry("tenantId", TENANT_ID)
                .doesNotContainKeys("$or", ID, sortField);
    }

    @ParameterizedTest
    @MethodSource("fetchDirections")
    void findMachinesWithCursor_idSortWithoutPosition_sortsByIdInFetchDirection(
            String direction, boolean backward, String operator, int order) {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().build();
        CursorPosition noPosition = new CursorPosition.None();

        // execution
        repository.findMachinesWithCursor(TENANT_ID, filter, null, noPosition, backward, FETCH_LIMIT, ID, direction);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Machine.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(ID, order));
        assertThat(query.getQueryObject()).doesNotContainKeys("$or", ID);
    }

    @ParameterizedTest
    @MethodSource("valueKeysetsInEachFetchDirection")
    void findMachinesWithCursor_keysetWithValue_continuesPastTheValueInFetchDirection(
            KeysetCursor cursor, boolean backward, List<Document> expectedBranches, int order) {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().build();
        String sortField = cursor.sortField();
        String direction = cursor.direction().name();

        // execution
        repository.findMachinesWithCursor(TENANT_ID, filter, null, cursor, backward, FETCH_LIMIT, sortField, direction);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Machine.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject().getList("$or", Document.class)).containsExactlyElementsOf(expectedBranches);
        assertThat(query.getQueryObject()).containsEntry("tenantId", TENANT_ID);
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(sortField, order).append(ID, order));
        verify(mongoTemplate, never()).findOne(any(Query.class), eq(Machine.class));
    }

    @ParameterizedTest
    @MethodSource("nullKeysetsFetchedAscending")
    void findMachinesWithCursor_nullValueKeysetFetchedAscending_restOfTheNullGroupThenEveryValue(
            KeysetCursor cursor, boolean backward) {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().build();
        String sortField = cursor.sortField();
        String direction = cursor.direction().name();
        Document restOfNullGroup = new Document(sortField, null).append(ID, new Document(GREATER, CURSOR_ID));
        Document everyValue = new Document(sortField, new Document("$ne", null));

        // execution
        repository.findMachinesWithCursor(TENANT_ID, filter, null, cursor, backward, FETCH_LIMIT, sortField, direction);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Machine.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject().getList("$or", Document.class)).containsExactly(restOfNullGroup, everyValue);
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(sortField, 1).append(ID, 1));
    }

    @ParameterizedTest
    @MethodSource("nullKeysetsFetchedDescending")
    void findMachinesWithCursor_nullValueKeysetFetchedDescending_onlyTheRestOfTheNullGroup(
            KeysetCursor cursor, boolean backward) {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().build();
        String sortField = cursor.sortField();
        String direction = cursor.direction().name();

        // execution
        repository.findMachinesWithCursor(TENANT_ID, filter, null, cursor, backward, FETCH_LIMIT, sortField, direction);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Machine.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject())
                .containsEntry(sortField, null)
                .containsEntry(ID, new Document(LESS, CURSOR_ID))
                .doesNotContainKey("$or");
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(sortField, -1).append(ID, -1));
    }

    @ParameterizedTest
    @MethodSource("fetchDirections")
    void findMachinesWithCursor_idSortKeyset_continuesPastTheIdInFetchDirection(
            String direction, boolean backward, String operator, int order) {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().build();
        Sort.Direction sortDirection = Sort.Direction.valueOf(direction);
        KeysetCursor cursor = new KeysetCursor(ID, sortDirection, "", CURSOR_HEX);

        // execution
        repository.findMachinesWithCursor(TENANT_ID, filter, null, cursor, backward, FETCH_LIMIT, ID, direction);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Machine.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject()).containsEntry(ID, new Document(operator, CURSOR_ID));
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(ID, order));
    }

    @ParameterizedTest
    @MethodSource("fetchDirections")
    void findMachinesWithCursor_rowIdUnderIdSort_completePositionWithoutReadingTheRow(
            String direction, boolean backward, String operator, int order) {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().build();
        CursorPosition rowId = new CursorPosition.RowId(CURSOR_HEX);

        // execution
        repository.findMachinesWithCursor(TENANT_ID, filter, null, rowId, backward, FETCH_LIMIT, ID, direction);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Machine.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject()).containsEntry(ID, new Document(operator, CURSOR_ID));
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(ID, order));
        verify(mongoTemplate, never()).findOne(any(Query.class), eq(Machine.class));
        verify(mongoTemplate, never()).findById(any(Object.class), eq(Machine.class));
    }

    @ParameterizedTest
    @MethodSource("rowsPerValueSort")
    void findMachinesWithCursor_rowIdUnderAValueSort_readsTheRowOnceInsideTheTenantAndUsesItsCurrentValue(
            String sortField, Machine row, Object currentValue) {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().build();
        CursorPosition rowId = new CursorPosition.RowId(CURSOR_HEX);
        Document pastValue = new Document(sortField, new Document(GREATER, currentValue));
        Document sameValuePastId = new Document(sortField, currentValue).append(ID, new Document(GREATER, CURSOR_ID));
        when(mongoTemplate.findOne(any(Query.class), eq(Machine.class))).thenReturn(row);

        // execution
        repository.findMachinesWithCursor(TENANT_ID, filter, null, rowId, false, FETCH_LIMIT, sortField, ASC);

        // verifications
        verify(mongoTemplate).findOne(queryCaptor.capture(), eq(Machine.class));
        assertThat(queryCaptor.getValue().getQueryObject())
                .containsEntry(ID, CURSOR_ID)
                .containsEntry("tenantId", TENANT_ID);
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Machine.class));
        assertThat(queryCaptor.getValue().getQueryObject().getList("$or", Document.class))
                .containsExactly(pastValue, sameValuePastId);
        verify(mongoTemplate, never()).findById(any(Object.class), eq(Machine.class));
    }

    @Test
    void findMachinesWithCursor_rowIdBackwardUnderAValueSort_flipsTheComparisonOnTheRowsValue() {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().build();
        CursorPosition rowId = new CursorPosition.RowId(CURSOR_HEX);
        Machine row = machine(CURSOR_HEX);
        row.setHostname(CURSOR_NAME);
        Document pastValue = new Document(HOSTNAME, new Document(LESS, CURSOR_NAME));
        Document sameValuePastId = new Document(HOSTNAME, CURSOR_NAME).append(ID, new Document(LESS, CURSOR_ID));
        Document nullGroup = new Document(HOSTNAME, null);
        when(mongoTemplate.findOne(any(Query.class), eq(Machine.class))).thenReturn(row);

        // execution
        repository.findMachinesWithCursor(TENANT_ID, filter, null, rowId, true, FETCH_LIMIT, HOSTNAME, ASC);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Machine.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject().getList("$or", Document.class))
                .containsExactly(pastValue, sameValuePastId, nullGroup);
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(HOSTNAME, -1).append(ID, -1));
    }

    @ParameterizedTest
    @ValueSource(strings = {HOSTNAME, "displayName", "nickname", LAST_SEEN})
    void findMachinesWithCursor_rowIdOfAMissingRowUnderAValueSort_throwsInvalidCursor(String sortField) {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().build();
        CursorPosition rowId = new CursorPosition.RowId(CURSOR_HEX);
        when(mongoTemplate.findOne(any(Query.class), eq(Machine.class))).thenReturn(null);

        // execution
        Throwable thrown = catchThrowable(() -> repository.findMachinesWithCursor(
                TENANT_ID, filter, null, rowId, false, FETCH_LIMIT, sortField, ASC));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verify(mongoTemplate, never()).find(any(Query.class), eq(Machine.class));
        verify(mongoTemplate, never()).findById(any(Object.class), eq(Machine.class));
    }

    @ParameterizedTest
    @CsvSource({
            "hostname, DESC",
            "nickname, ASC",
            "lastSeen, ASC",
            "_id, ASC"
    })
    void findMachinesWithCursor_keysetIssuedUnderAnotherSortFieldOrDirection_throwsInvalidCursor(
            String sortField, String direction) {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().build();
        KeysetCursor hostnameAscending = KeysetCursor.ofString(HOSTNAME, Sort.Direction.ASC, CURSOR_NAME, CURSOR_HEX);

        // execution
        Throwable thrown = catchThrowable(() -> repository.findMachinesWithCursor(
                TENANT_ID, filter, null, hostnameAscending, false, FETCH_LIMIT, sortField, direction));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verify(mongoTemplate, never()).find(any(Query.class), eq(Machine.class));
    }

    @ParameterizedTest
    @MethodSource("unreadableDevicePositions")
    void findMachinesWithCursor_positionThatIsNotADevicePosition_throwsInvalidCursor(
            CursorPosition position, String sortField) {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().build();

        // execution
        Throwable thrown = catchThrowable(() -> repository.findMachinesWithCursor(
                TENANT_ID, filter, null, position, false, FETCH_LIMIT, sortField, ASC));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verify(mongoTemplate, never()).find(any(Query.class), eq(Machine.class));
        verify(mongoTemplate, never()).findOne(any(Query.class), eq(Machine.class));
    }

    @ParameterizedTest
    @MethodSource("machinesPerValueSort")
    void keysetCursor_valueSort_carriesTheSortFieldDirectionValueAndId(
            String sortField, String direction, Machine machine, String expectedPayload) {
        // execution
        KeysetCursor cursor = repository.keysetCursor(machine, sortField, direction);

        // verifications
        assertThat(CursorBase64.decode(cursor.encode())).isEqualTo(expectedPayload);
    }

    @ParameterizedTest
    @CsvSource({
            "ASC, k1|_id|ASC||65f1a2b3c4d5e6f708192a3b",
            "DESC, k1|_id|DESC||65f1a2b3c4d5e6f708192a3b"
    })
    void keysetCursor_idSort_carriesAnEmptyValue(String direction, String expectedPayload) {
        // setup
        Machine machine = machine(CURSOR_HEX);
        machine.setHostname(CURSOR_NAME);

        // execution
        KeysetCursor cursor = repository.keysetCursor(machine, ID, direction);

        // verifications
        assertThat(CursorBase64.decode(cursor.encode())).isEqualTo(expectedPayload);
        assertThat(cursor.hasNullValue()).isTrue();
    }

    @ParameterizedTest
    @CsvSource({
            "false, 1",
            "true, -1"
    })
    void findAvailableForScheduleWithCursor_noPosition_sortsByBucketThenIdInFetchDirection(boolean backward, int order) {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().build();
        List<String> assigned = List.of(ASSIGNED_MACHINE_ID);
        CursorPosition noPosition = new CursorPosition.None();
        stubNoRows();

        // execution
        repository.findAvailableForScheduleWithCursor(TENANT_ID, filter, null, assigned, noPosition, backward, FETCH_LIMIT);

        // verifications
        List<Document> stages = capturedStages();
        assertThat(stages).hasSize(4);
        assertThat(stages.getFirst().get("$match", Document.class)).containsEntry("tenantId", TENANT_ID);
        assertThat(stages.get(1)).containsOnlyKeys("$addFields");
        assertThat(stages.get(2).get("$sort", Document.class))
                .containsExactlyEntriesOf(new Document(BUCKET_FIELD, order).append(ID, order));
        assertThat(stages.get(3)).containsEntry("$limit", (long) FETCH_LIMIT);
    }

    @ParameterizedTest
    @MethodSource("bucketPositionsInEachFetchDirection")
    void findAvailableForScheduleWithCursor_bucketPosition_continuesPastBucketAndIdInFetchDirection(
            CursorPosition position, boolean backward, String operator, int order) {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().build();
        List<String> assigned = List.of(ASSIGNED_MACHINE_ID);
        Document pastBucket = new Document(BUCKET_FIELD, new Document(operator, 2));
        Document sameBucketPastId = new Document(BUCKET_FIELD, 2).append(ID, new Document(operator, CURSOR_ID));
        stubNoRows();

        // execution
        repository.findAvailableForScheduleWithCursor(TENANT_ID, filter, null, assigned, position, backward, FETCH_LIMIT);

        // verifications
        List<Document> stages = capturedStages();
        assertThat(stages).hasSize(5);
        assertThat(stages.getFirst().get("$match", Document.class)).containsEntry("tenantId", TENANT_ID);
        assertThat(stages.get(2).get("$match", Document.class).getList("$or", Document.class))
                .containsExactly(pastBucket, sameBucketPastId);
        assertThat(stages.get(3).get("$sort", Document.class))
                .containsExactlyEntriesOf(new Document(BUCKET_FIELD, order).append(ID, order));
        verify(mongoTemplate, never()).findOne(any(Query.class), eq(Machine.class));
        verify(mongoTemplate, never()).findById(any(Object.class), eq(Machine.class));
    }

    @ParameterizedTest
    @MethodSource("unreadableBucketPositions")
    void findAvailableForScheduleWithCursor_positionThatIsNotABucketPosition_throwsInvalidCursor(
            CursorPosition position) {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().build();
        List<String> assigned = List.of(ASSIGNED_MACHINE_ID);

        // execution
        Throwable thrown = catchThrowable(() -> repository.findAvailableForScheduleWithCursor(
                TENANT_ID, filter, null, assigned, position, false, FETCH_LIMIT));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verify(mongoTemplate, never()).aggregate(any(Aggregation.class), eq(Machine.class), eq(Document.class));
    }

    @ParameterizedTest
    @MethodSource("machinesPerBucket")
    void availableForScheduleKeysetCursor_assignmentAndConnectivity_carriesTheBucketInAscendingOrder(
            String machineId, TelemetryStatus telemetryStatus, Collection<String> assigned, String expectedPayload) {
        // setup
        Machine machine = machine(CURSOR_HEX);
        machine.setMachineId(machineId);
        machine.setTelemetryStatus(telemetryStatus);

        // execution
        KeysetCursor cursor = repository.availableForScheduleKeysetCursor(machine, assigned);

        // verifications
        assertThat(CursorBase64.decode(cursor.encode())).isEqualTo(expectedPayload);
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

    private static Stream<Arguments> fetchDirections() {
        return Stream.of(
                arguments(ASC, false, GREATER, 1),
                arguments(ASC, true, LESS, -1),
                arguments(DESC, false, LESS, -1),
                arguments(DESC, true, GREATER, 1));
    }

    private static Stream<Arguments> valueSortsInEachFetchDirection() {
        return VALUE_SORT_FIELDS.stream().flatMap(sortField -> Stream.of(
                arguments(sortField, ASC, false, 1),
                arguments(sortField, ASC, true, -1),
                arguments(sortField, DESC, false, -1),
                arguments(sortField, DESC, true, 1)));
    }

    private static Stream<Arguments> valueKeysetsInEachFetchDirection() {
        return VALUE_SORT_FIELDS.stream().flatMap(sortField -> Stream.of(
                arguments(valueKeyset(sortField, Sort.Direction.ASC), false, branchesPastValue(sortField, GREATER, false), 1),
                arguments(valueKeyset(sortField, Sort.Direction.ASC), true, branchesPastValue(sortField, LESS, true), -1),
                arguments(valueKeyset(sortField, Sort.Direction.DESC), false, branchesPastValue(sortField, LESS, true), -1),
                arguments(valueKeyset(sortField, Sort.Direction.DESC), true, branchesPastValue(sortField, GREATER, false), 1)));
    }

    private static Stream<Arguments> nullKeysetsFetchedAscending() {
        return VALUE_SORT_FIELDS.stream().flatMap(sortField -> Stream.of(
                arguments(nullKeyset(sortField, Sort.Direction.ASC), false),
                arguments(nullKeyset(sortField, Sort.Direction.DESC), true)));
    }

    private static Stream<Arguments> nullKeysetsFetchedDescending() {
        return VALUE_SORT_FIELDS.stream().flatMap(sortField -> Stream.of(
                arguments(nullKeyset(sortField, Sort.Direction.DESC), false),
                arguments(nullKeyset(sortField, Sort.Direction.ASC), true)));
    }

    private static Stream<Arguments> rowsPerValueSort() {
        Machine named = machine(CURSOR_HEX);
        named.setHostname(CURSOR_NAME);
        named.setDisplayName(CURSOR_NAME);
        named.setNickname(CURSOR_NAME);
        named.setLastSeen(CURSOR_LAST_SEEN);
        return Stream.of(
                arguments(HOSTNAME, named, CURSOR_NAME),
                arguments("displayName", named, CURSOR_NAME),
                arguments("nickname", named, CURSOR_NAME),
                arguments(LAST_SEEN, named, CURSOR_LAST_SEEN));
    }

    private static Stream<Arguments> unreadableDevicePositions() {
        String notBase64 = "%%%";
        return Stream.of(
                arguments(new CursorPosition.Unrecognised("2|" + CURSOR_HEX), HOSTNAME),
                arguments(new CursorPosition.Unrecognised("not-a-cursor"), ID),
                arguments(KeysetCursor.ofString(HOSTNAME, Sort.Direction.ASC, CURSOR_NAME, "not-an-object-id"), HOSTNAME),
                arguments(new KeysetCursor(ID, Sort.Direction.ASC, "", "not-an-object-id"), ID),
                arguments(new KeysetCursor(HOSTNAME, Sort.Direction.ASC, notBase64, CURSOR_HEX), HOSTNAME),
                arguments(new KeysetCursor(LAST_SEEN, Sort.Direction.ASC, "yesterday", CURSOR_HEX), LAST_SEEN));
    }

    private static Stream<Arguments> machinesPerValueSort() {
        Machine named = machine(CURSOR_HEX);
        named.setHostname(CURSOR_NAME);
        named.setDisplayName("Display M");
        named.setNickname("");
        named.setLastSeen(CURSOR_LAST_SEEN);
        Machine blank = machine(CURSOR_HEX);
        return Stream.of(
                arguments(HOSTNAME, ASC, named, "k1|hostname|ASC|" + base64(CURSOR_NAME) + "|" + CURSOR_HEX),
                arguments("displayName", DESC, named, "k1|displayName|DESC|" + base64("Display M") + "|" + CURSOR_HEX),
                arguments("nickname", ASC, named, "k1|nickname|ASC|=|" + CURSOR_HEX),
                arguments(LAST_SEEN, DESC, named, "k1|lastSeen|DESC|1700000000123|" + CURSOR_HEX),
                arguments(HOSTNAME, DESC, blank, "k1|hostname|DESC||" + CURSOR_HEX),
                arguments("displayName", ASC, blank, "k1|displayName|ASC||" + CURSOR_HEX),
                arguments("nickname", DESC, blank, "k1|nickname|DESC||" + CURSOR_HEX),
                arguments(LAST_SEEN, ASC, blank, "k1|lastSeen|ASC||" + CURSOR_HEX));
    }

    private static Stream<Arguments> bucketPositionsInEachFetchDirection() {
        CursorPosition keyset = new KeysetCursor(BUCKET, Sort.Direction.ASC, "2", CURSOR_HEX);
        CursorPosition olderFormat = new CursorPosition.Unrecognised("2|" + CURSOR_HEX);
        return Stream.of(
                arguments(keyset, false, GREATER, 1),
                arguments(keyset, true, LESS, -1),
                arguments(olderFormat, false, GREATER, 1),
                arguments(olderFormat, true, LESS, -1));
    }

    private static Stream<Arguments> unreadableBucketPositions() {
        return Stream.of(
                arguments(new CursorPosition.Unrecognised("not-a-cursor")),
                arguments(new CursorPosition.Unrecognised("two|" + CURSOR_HEX)),
                arguments(new CursorPosition.Unrecognised("2|not-an-object-id")),
                arguments(new CursorPosition.Unrecognised("2|")),
                arguments(new CursorPosition.RowId(CURSOR_HEX)),
                arguments(new KeysetCursor(BUCKET, Sort.Direction.DESC, "2", CURSOR_HEX)),
                arguments(new KeysetCursor(BUCKET, Sort.Direction.ASC, "two", CURSOR_HEX)),
                arguments(new KeysetCursor(BUCKET, Sort.Direction.ASC, "", CURSOR_HEX)),
                arguments(new KeysetCursor(BUCKET, Sort.Direction.ASC, "2", "not-an-object-id")),
                arguments(KeysetCursor.ofString(HOSTNAME, Sort.Direction.ASC, CURSOR_NAME, CURSOR_HEX)));
    }

    private static Stream<Arguments> machinesPerBucket() {
        List<String> assigned = List.of(ASSIGNED_MACHINE_ID);
        String prefix = "k1|bucket|ASC|";
        String suffix = "|" + CURSOR_HEX;
        return Stream.of(
                arguments(ASSIGNED_MACHINE_ID, TelemetryStatus.ONLINE, assigned, prefix + 0 + suffix),
                arguments(ASSIGNED_MACHINE_ID, TelemetryStatus.OFFLINE, assigned, prefix + 1 + suffix),
                arguments(ASSIGNED_MACHINE_ID, null, assigned, prefix + 1 + suffix),
                arguments("machine-other", TelemetryStatus.ONLINE, assigned, prefix + 2 + suffix),
                arguments("machine-other", TelemetryStatus.OFFLINE, assigned, prefix + 3 + suffix),
                arguments(ASSIGNED_MACHINE_ID, TelemetryStatus.ONLINE, null, prefix + 2 + suffix));
    }

    private static KeysetCursor valueKeyset(String sortField, Sort.Direction direction) {
        return LAST_SEEN.equals(sortField)
                ? KeysetCursor.ofInstant(sortField, direction, CURSOR_LAST_SEEN, CURSOR_HEX)
                : KeysetCursor.ofString(sortField, direction, CURSOR_NAME, CURSOR_HEX);
    }

    private static KeysetCursor nullKeyset(String sortField, Sort.Direction direction) {
        return new KeysetCursor(sortField, direction, "", CURSOR_HEX);
    }

    private static List<Document> branchesPastValue(String sortField, String operator, boolean nullGroupAhead) {
        Object value = LAST_SEEN.equals(sortField) ? CURSOR_LAST_SEEN : CURSOR_NAME;
        Document pastValue = new Document(sortField, new Document(operator, value));
        Document sameValuePastId = new Document(sortField, value).append(ID, new Document(operator, CURSOR_ID));
        Document nullGroup = new Document(sortField, null);
        return nullGroupAhead ? List.of(pastValue, sameValuePastId, nullGroup) : List.of(pastValue, sameValuePastId);
    }

    private static Machine machine(String id) {
        Machine machine = new Machine();
        machine.setId(id);
        return machine;
    }

    private static String base64(String text) {
        return Base64.getEncoder().encodeToString(text.getBytes(StandardCharsets.UTF_8));
    }

    private void stubNoRows() {
        AggregationResults<Document> noRows = new AggregationResults<>(List.of(), new Document());
        when(mongoTemplate.aggregate(any(Aggregation.class), eq(Machine.class), eq(Document.class))).thenReturn(noRows);
    }

    private List<Document> capturedStages() {
        verify(mongoTemplate).aggregate(aggregationCaptor.capture(), eq(Machine.class), eq(Document.class));
        return aggregationCaptor.getValue().toPipeline(Aggregation.DEFAULT_CONTEXT);
    }
}
