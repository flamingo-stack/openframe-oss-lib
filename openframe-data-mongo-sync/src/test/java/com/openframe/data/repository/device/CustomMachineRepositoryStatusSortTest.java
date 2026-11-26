package com.openframe.data.repository.device;

import com.openframe.core.exception.InvalidCursorException;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.filter.MachineQueryFilter;
import com.openframe.data.repository.cursor.CursorPosition;
import com.openframe.data.repository.cursor.KeysetCursor;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
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
import org.springframework.data.mongodb.core.convert.MongoConverter;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomMachineRepositoryStatusSortTest {

    private static final String TENANT_ID = "tenant-1";
    private static final List<String> DESC_ORDER = List.of("MANAGED", "ONLINE", "OFFLINE", "PENDING", "PENDING_DELETION");
    private static final int UNKNOWN_RANK = 0;
    private static final String STATUS = "status";
    private static final String RANK_FIELD = "_statusRank";
    private static final String INVALID_CURSOR = "Invalid cursor";
    private static final String CURSOR_HEX = "65f1a2b3c4d5e6f708192a3b";
    private static final ObjectId CURSOR_ID = new ObjectId(CURSOR_HEX);
    private static final CursorPosition NO_POSITION = new CursorPosition.None();

    @Mock private MongoTemplate mongoTemplate;
    @Mock private MongoConverter converter;
    @Captor private ArgumentCaptor<Aggregation> aggregationCaptor;
    @Captor private ArgumentCaptor<Query> queryCaptor;
    @InjectMocks private CustomMachineRepositoryImpl repository;

    @Test
    @DisplayName("status ASC: rank from the DESC order, then sort by (rank, _id) ascending")
    void statusAsc_ranksByExplicitOrder() {
        // setup
        stubAggregate(List.of());

        // execution
        repository.findMachinesWithCursor(TENANT_ID, filter(), null, NO_POSITION, false, 10, "status", "ASC");

        // verifications
        List<Document> stages = capturedStages();
        assertThat(stages).hasSize(4);
        assertThat(stages.get(0).get("$match", Document.class)).containsEntry("tenantId", TENANT_ID);
        Document rank = stages.get(1).get("$addFields", Document.class).get("_statusRank", Document.class);
        List<?> cond = rank.getList("$cond", Object.class);
        Document index = new Document("$indexOfArray", List.of(DESC_ORDER, "$status"));
        assertThat(cond.get(0)).isEqualTo(new Document("$in", List.of("$status", DESC_ORDER)));
        assertThat(cond.get(1)).isEqualTo(new Document("$subtract", List.of(5, index)));
        assertThat(cond.get(2)).isEqualTo(UNKNOWN_RANK);
        assertThat(stages.get(2).get("$sort", Document.class))
                .containsExactly(entry("_statusRank", 1), entry("_id", 1));
        assertThat(stages.get(3)).containsEntry("$limit", 10L);
        verify(mongoTemplate, never()).find(any(Query.class), eq(Machine.class));
    }

    @Test
    @DisplayName("status DESC: the same rank, sorted by (rank, _id) descending = MANAGED, ONLINE, OFFLINE, PENDING, PENDING_DELETION")
    void statusDesc_reversesExplicitOrder() {
        // setup
        stubAggregate(List.of());

        // execution
        repository.findMachinesWithCursor(TENANT_ID, filter(), null, NO_POSITION, false, 5, "status", "DESC");

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
        repository.findMachinesWithCursor(TENANT_ID, filter(), null, rowId(cursorId), false, 10, "status", "ASC");

        // verifications
        List<Document> stages = capturedStages();
        assertThat(stages).hasSize(5);
        List<Document> branches = stages.get(2).get("$match", Document.class).getList("$or", Document.class);
        assertThat(branches).containsExactly(
                new Document("_statusRank", new Document("$gt", 2)),
                new Document("_statusRank", 2).append("_id", new Document("$gt", cursorId)));
    }

    @Test
    @DisplayName("status DESC cursor: continues before the cursor's rank, or before its _id within the same rank")
    void statusDescCursor_keysetOverRankAndId() {
        // setup
        ObjectId cursorId = new ObjectId();
        stubCursorDocument(cursorId, DeviceStatus.OFFLINE);
        stubAggregate(List.of());

        // execution
        repository.findMachinesWithCursor(TENANT_ID, filter(), null, rowId(cursorId), false, 10, "status", "DESC");

        // verifications
        List<Document> branches = capturedStages().get(2).get("$match", Document.class).getList("$or", Document.class);
        assertThat(branches).containsExactly(
                new Document("_statusRank", new Document("$lt", 3)),
                new Document("_statusRank", 3).append("_id", new Document("$lt", cursorId)));
    }

    @Test
    @DisplayName("status row-id cursor whose row is gone: invalid cursor, no page is read")
    void statusCursor_missingDocument_throwsInvalidCursor() {
        // setup
        ObjectId cursorId = new ObjectId();
        CursorPosition position = rowId(cursorId);
        when(mongoTemplate.findOne(any(Query.class), eq(Machine.class))).thenReturn(null);

        // execution
        Throwable thrown = catchThrowable(() -> repository.findMachinesWithCursor(
                TENANT_ID, filter(), null, position, false, 10, STATUS, "ASC"));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verify(mongoTemplate, never()).aggregate(any(Aggregation.class), eq(Machine.class), eq(Document.class));
        verify(mongoTemplate, never()).findById(any(Object.class), eq(Machine.class));
    }

    @Test
    @DisplayName("status sort with a cursor that is not a device position: invalid cursor, no row and no page is read")
    void statusCursor_malformed_throwsInvalidCursor() {
        // setup
        CursorPosition position = new CursorPosition.Unrecognised("not-an-object-id");

        // execution
        Throwable thrown = catchThrowable(() -> repository.findMachinesWithCursor(
                TENANT_ID, filter(), null, position, false, 10, STATUS, "ASC"));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verify(mongoTemplate, never()).aggregate(any(Aggregation.class), eq(Machine.class), eq(Document.class));
        verify(mongoTemplate, never()).findOne(any(Query.class), eq(Machine.class));
    }

    @Test
    @DisplayName("status row-id cursor: the row is read once inside the tenant, never by a bare id lookup")
    void statusRowIdCursor_readsTheRowInsideTheTenant() {
        // setup
        ObjectId cursorId = new ObjectId();
        stubCursorDocument(cursorId, DeviceStatus.PENDING);
        stubAggregate(List.of());

        // execution
        repository.findMachinesWithCursor(TENANT_ID, filter(), null, rowId(cursorId), false, 10, STATUS, "ASC");

        // verifications
        verify(mongoTemplate).findOne(queryCaptor.capture(), eq(Machine.class));
        assertThat(queryCaptor.getValue().getQueryObject())
                .containsEntry("_id", cursorId)
                .containsEntry("tenantId", TENANT_ID);
        verify(mongoTemplate, never()).findById(any(Object.class), eq(Machine.class));
    }

    @ParameterizedTest
    @CsvSource({
            "ASC, -1",
            "DESC, 1"
    })
    @DisplayName("status backward: the (rank, _id) sort runs against the display direction")
    void statusBackward_sortsAgainstTheDisplayDirection(String direction, int order) {
        // setup
        stubAggregate(List.of());

        // execution
        repository.findMachinesWithCursor(TENANT_ID, filter(), null, NO_POSITION, true, 10, STATUS, direction);

        // verifications
        List<Document> stages = capturedStages();
        assertThat(stages).hasSize(4);
        assertThat(stages.get(0).get("$match", Document.class)).containsEntry("tenantId", TENANT_ID);
        assertThat(stages.get(2).get("$sort", Document.class))
                .containsExactly(entry(RANK_FIELD, order), entry("_id", order));
    }

    @ParameterizedTest
    @MethodSource("rankKeysetsInEachFetchDirection")
    @DisplayName("status keyset cursor: continues from the carried rank in the fetch direction, without reading the row")
    void statusKeysetCursor_continuesFromTheCarriedRankInFetchDirection(
            KeysetCursor cursor, boolean backward, String operator, int order) {
        // setup
        String direction = cursor.direction().name();
        stubAggregate(List.of());

        // execution
        repository.findMachinesWithCursor(TENANT_ID, filter(), null, cursor, backward, 10, STATUS, direction);

        // verifications
        List<Document> stages = capturedStages();
        assertThat(stages).hasSize(5);
        assertThat(stages.get(0).get("$match", Document.class)).containsEntry("tenantId", TENANT_ID);
        assertThat(stages.get(2).get("$match", Document.class).getList("$or", Document.class)).containsExactly(
                new Document(RANK_FIELD, new Document(operator, 3)),
                new Document(RANK_FIELD, 3).append("_id", new Document(operator, CURSOR_ID)));
        assertThat(stages.get(3).get("$sort", Document.class))
                .containsExactly(entry(RANK_FIELD, order), entry("_id", order));
        verify(mongoTemplate, never()).findOne(any(Query.class), eq(Machine.class));
        verify(mongoTemplate, never()).findById(any(Object.class), eq(Machine.class));
    }

    @Test
    @DisplayName("status row-id cursor backward: the comparison flips on the row's current rank")
    void statusRowIdCursorBackward_flipsTheComparisonOnTheCurrentRank() {
        // setup
        ObjectId cursorId = new ObjectId();
        stubCursorDocument(cursorId, DeviceStatus.PENDING);
        stubAggregate(List.of());

        // execution
        repository.findMachinesWithCursor(TENANT_ID, filter(), null, rowId(cursorId), true, 10, STATUS, "ASC");

        // verifications
        List<Document> stages = capturedStages();
        assertThat(stages.get(2).get("$match", Document.class).getList("$or", Document.class)).containsExactly(
                new Document(RANK_FIELD, new Document("$lt", 2)),
                new Document(RANK_FIELD, 2).append("_id", new Document("$lt", cursorId)));
        assertThat(stages.get(3).get("$sort", Document.class))
                .containsExactly(entry(RANK_FIELD, -1), entry("_id", -1));
    }

    @ParameterizedTest
    @MethodSource("unreadableRankKeysets")
    @DisplayName("status keyset cursor from another sort, direction, or with an unreadable rank or id: invalid cursor")
    void statusKeysetCursor_notAStatusPosition_throwsInvalidCursor(KeysetCursor cursor) {
        // execution
        Throwable thrown = catchThrowable(() -> repository.findMachinesWithCursor(
                TENANT_ID, filter(), null, cursor, false, 10, STATUS, "DESC"));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verify(mongoTemplate, never()).aggregate(any(Aggregation.class), eq(Machine.class), eq(Document.class));
    }

    @ParameterizedTest
    @CsvSource({
            "MANAGED, DESC, 5",
            "OFFLINE, ASC, 3",
            "ARCHIVED, DESC, 0"
    })
    @DisplayName("status keyset cursor issued for a row carries its rank at that moment")
    void keysetCursor_statusSort_carriesTheRankAtIssueTime(DeviceStatus status, String direction, String rank) {
        // setup
        Machine machine = machine(status);
        machine.setId(CURSOR_HEX);
        Sort.Direction sortDirection = Sort.Direction.valueOf(direction);

        // execution
        KeysetCursor cursor = repository.keysetCursor(machine, STATUS, direction);

        // verifications
        assertThat(cursor).isEqualTo(new KeysetCursor(STATUS, sortDirection, rank, CURSOR_HEX));
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
        List<Machine> machines = repository.findMachinesWithCursor(TENANT_ID, filter(), null, NO_POSITION, false, 10, "status", "ASC");

        // verifications
        assertThat(machines).containsExactly(first, second);
    }

    @Test
    @DisplayName("sorting by another field keeps the plain find() path")
    void otherSortField_usesFind() {
        // execution
        repository.findMachinesWithCursor(TENANT_ID, filter(), null, NO_POSITION, false, 10, "hostname", "ASC");

        // verifications
        verify(mongoTemplate).find(any(Query.class), eq(Machine.class));
        verify(mongoTemplate, never()).aggregate(any(Aggregation.class), eq(Machine.class), eq(Document.class));
    }

    @Test
    @DisplayName("statusRank: MANAGED > ONLINE > OFFLINE > PENDING > PENDING_DELETION > missing status, so DESC puts MANAGED first")
    void statusRank_followsExplicitOrder() {
        assertThat(CustomMachineRepositoryImpl.statusRank(DeviceStatus.MANAGED)).isEqualTo(5);
        assertThat(CustomMachineRepositoryImpl.statusRank(DeviceStatus.ONLINE)).isEqualTo(4);
        assertThat(CustomMachineRepositoryImpl.statusRank(DeviceStatus.OFFLINE)).isEqualTo(3);
        assertThat(CustomMachineRepositoryImpl.statusRank(DeviceStatus.PENDING)).isEqualTo(2);
        assertThat(CustomMachineRepositoryImpl.statusRank(DeviceStatus.PENDING_DELETION)).isEqualTo(1);
        assertThat(CustomMachineRepositoryImpl.statusRank(null)).isEqualTo(UNKNOWN_RANK);
    }

    @ParameterizedTest
    @EnumSource(value = DeviceStatus.class, names = {"MANAGED", "ONLINE", "OFFLINE", "PENDING", "PENDING_DELETION"},
            mode = EnumSource.Mode.EXCLUDE)
    @DisplayName("statusRank: every status outside the explicit order ranks below PENDING_DELETION")
    void statusRank_otherStatusesRankLast(DeviceStatus status) {
        assertThat(CustomMachineRepositoryImpl.statusRank(status)).isEqualTo(UNKNOWN_RANK);
    }

    private static MachineQueryFilter filter() {
        return MachineQueryFilter.builder().build();
    }

    private static Stream<Arguments> rankKeysetsInEachFetchDirection() {
        KeysetCursor ascending = new KeysetCursor(STATUS, Sort.Direction.ASC, "3", CURSOR_HEX);
        KeysetCursor descending = new KeysetCursor(STATUS, Sort.Direction.DESC, "3", CURSOR_HEX);
        return Stream.of(
                arguments(ascending, false, "$gt", 1),
                arguments(ascending, true, "$lt", -1),
                arguments(descending, false, "$lt", -1),
                arguments(descending, true, "$gt", 1));
    }

    private static Stream<Arguments> unreadableRankKeysets() {
        return Stream.of(
                arguments(new KeysetCursor(STATUS, Sort.Direction.ASC, "3", CURSOR_HEX)),
                arguments(new KeysetCursor("connectivity", Sort.Direction.DESC, "1", CURSOR_HEX)),
                arguments(KeysetCursor.ofString("hostname", Sort.Direction.DESC, "host-m", CURSOR_HEX)),
                arguments(new KeysetCursor(STATUS, Sort.Direction.DESC, "MANAGED", CURSOR_HEX)),
                arguments(new KeysetCursor(STATUS, Sort.Direction.DESC, "", CURSOR_HEX)),
                arguments(new KeysetCursor(STATUS, Sort.Direction.DESC, "3", "not-an-object-id")));
    }

    private static CursorPosition rowId(ObjectId id) {
        return new CursorPosition.RowId(id.toHexString());
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
