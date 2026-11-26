package com.openframe.data.repository.ticket;

import com.openframe.core.exception.InvalidCursorException;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketStatusKind;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import com.openframe.data.repository.cursor.CursorBase64;
import com.openframe.data.repository.cursor.CursorPosition;
import com.openframe.data.repository.cursor.KeysetCursor;
import com.openframe.data.repository.ticket.publishing.TicketAggregateSpec;
import com.openframe.publishing.api.OutboxPublisher;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.query.Query;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
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
class CustomTicketRepositoryCursorTest {

    private static final String ID_FIELD = "_id";
    private static final String TICKET_NUMBER = "ticketNumber";
    private static final String STATUS_KIND = "statusKind";
    private static final String ORGANIZATION_NAME = "organizationName";
    private static final String ASSIGNED_NAME = "assignedName";
    private static final String DEVICE_HOSTNAME = "deviceHostname";
    private static final String CREATED_AT = "createdAt";
    private static final String UPDATED_AT = "updatedAt";
    private static final String RESOLVED_AT = "resolvedAt";
    private static final String LAST_ACTIVITY_AT = "lastActivityAt";
    private static final String ORDER = "order";
    private static final List<String> VALUE_SORTS = List.of(TICKET_NUMBER, STATUS_KIND, ORGANIZATION_NAME,
            ASSIGNED_NAME, DEVICE_HOSTNAME, CREATED_AT, UPDATED_AT, RESOLVED_AT, LAST_ACTIVITY_AT, ORDER);
    private static final String AND_OPERATOR = "$and";
    private static final String OR_OPERATOR = "$or";
    private static final String GREATER = "$gt";
    private static final String LESS = "$lt";
    private static final String NOT_EQUAL = "$ne";
    private static final String ASC = "ASC";
    private static final String DESC = "DESC";
    private static final String INVALID_CURSOR = "Invalid cursor";
    private static final String CURSOR_HEX = "65f1a2b3c4d5e6f708192a3b";
    private static final ObjectId CURSOR_ID = new ObjectId(CURSOR_HEX);
    private static final String NOT_AN_OBJECT_ID = "not-an-object-id";
    private static final int CURSOR_TICKET_NUMBER = 4217;
    private static final TicketStatusKind CURSOR_STATUS_KIND = TicketStatusKind.TECH_REQUIRED;
    private static final String CURSOR_ORGANIZATION_NAME = "Acme Corp";
    private static final String CURSOR_ASSIGNED_NAME = "Dana Fox";
    private static final String CURSOR_DEVICE_HOSTNAME = "ws-042";
    private static final String CURSOR_ORDER = "m5";
    private static final Instant CURSOR_CREATED_AT = Instant.ofEpochMilli(1_700_000_000_123L);
    private static final Instant CURSOR_UPDATED_AT = CURSOR_CREATED_AT.plusSeconds(60);
    private static final Instant CURSOR_RESOLVED_AT = CURSOR_CREATED_AT.plusSeconds(120);
    private static final Instant CURSOR_LAST_ACTIVITY_AT = CURSOR_CREATED_AT.plusSeconds(180);
    private static final int FETCH_LIMIT = 21;

    @Mock private TenantAwareMongoTemplate mongoTemplate;
    @Mock private ObjectProvider<OutboxPublisher> outboxPublisher;
    @Mock private ObjectProvider<TicketAggregateSpec> ticketSpec;

    @Captor private ArgumentCaptor<Query> queryCaptor;

    private CustomTicketRepositoryImpl repository;

    @BeforeEach
    void setUp() {
        repository = new CustomTicketRepositoryImpl(mongoTemplate, outboxPublisher, ticketSpec);
    }

    @Test
    @DisplayName("Given a query already restricted by ticket ids, when a cursor page is fetched sorted by _id, then both the id restriction and the cursor bound survive instead of Query rejecting the second '_id' criterion")
    void keepsIdRestrictionAlongsideIdCursorBound() {
        when(mongoTemplate.find(any(Query.class), eq(Ticket.class))).thenReturn(List.of());
        Query filtered = repository.buildTicketQuery(null, null, List.of("ticket-1", "ticket-2"), null);
        ObjectId cursorId = new ObjectId();
        CursorPosition position = new CursorPosition.RowId(cursorId.toHexString());

        repository.findTicketsWithCursor(filtered, position, false, 20, ID_FIELD, "DESC");

        Document executed = captureExecutedQuery();
        assertThat(executed.get(ID_FIELD, Document.class).get("$in"))
                .isEqualTo(List.of("ticket-1", "ticket-2"));
        assertThat(cursorBoundOf(executed).get(ID_FIELD, Document.class).get("$lt"))
                .isEqualTo(cursorId);
    }

    @Test
    @DisplayName("Given a search query, when a cursor page is fetched sorted by a field other than _id, then the search's $or and the cursor's own $or coexist instead of colliding on the same key")
    void keepsSearchAlongsideNonIdCursorBound() {
        when(mongoTemplate.find(any(Query.class), eq(Ticket.class))).thenReturn(List.of());
        when(mongoTemplate.findOne(any(Query.class), eq(Ticket.class)))
                .thenReturn(Ticket.builder().id(CURSOR_HEX).createdAt(Instant.parse("2026-08-01T00:00:00Z")).build());
        Query searched = repository.buildTicketQuery(null, "printer", null, null);
        CursorPosition position = new CursorPosition.RowId(CURSOR_HEX);

        repository.findTicketsWithCursor(searched, position, false, 20, "createdAt", "DESC");

        Document executed = captureExecutedQuery();
        assertThat(executed.get(OR_OPERATOR)).isNotNull();
        assertThat(cursorBoundOf(executed).get(OR_OPERATOR)).isNotNull();
    }

    @Test
    @DisplayName("Given no cursor, when the first page is fetched, then no $and wrapper is introduced and the plain filter is executed as-is")
    void leavesFirstPageQueryUntouched() {
        when(mongoTemplate.find(any(Query.class), eq(Ticket.class))).thenReturn(List.of());
        Query filtered = repository.buildTicketQuery(null, null, List.of("ticket-1"), null);

        repository.findTicketsWithCursor(filtered, new CursorPosition.None(), false, 20, ID_FIELD, "DESC");

        Document executed = captureExecutedQuery();
        assertThat(executed.get(AND_OPERATOR)).isNull();
        assertThat(executed.get(ID_FIELD, Document.class).get("$in")).isEqualTo(List.of("ticket-1"));
    }

    @ParameterizedTest
    @MethodSource("valueSortsInEachFetchDirection")
    void findTicketsWithCursor_valueSortWithoutPosition_sortsByFieldThenIdInFetchDirection(
            String sortField, String sortDirection, boolean backward, int order) {
        // setup
        Query unfiltered = new Query();
        CursorPosition noPosition = new CursorPosition.None();

        // execution
        repository.findTicketsWithCursor(unfiltered, noPosition, backward, FETCH_LIMIT, sortField, sortDirection);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Ticket.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getSortObject())
                .containsExactlyEntriesOf(new Document(sortField, order).append(ID_FIELD, order));
        assertThat(query.getLimit()).isEqualTo(FETCH_LIMIT);
        assertThat(query.getQueryObject()).isEmpty();
    }

    @ParameterizedTest
    @MethodSource("fetchDirections")
    void findTicketsWithCursor_idSortWithoutPosition_sortsByIdInFetchDirection(
            Sort.Direction direction, boolean backward, String operator, int order) {
        // setup
        Query unfiltered = new Query();
        CursorPosition noPosition = new CursorPosition.None();

        // execution
        repository.findTicketsWithCursor(unfiltered, noPosition, backward, FETCH_LIMIT, ID_FIELD, direction.name());

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Ticket.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(ID_FIELD, order));
        assertThat(query.getLimit()).isEqualTo(FETCH_LIMIT);
        assertThat(query.getQueryObject()).isEmpty();
    }

    @ParameterizedTest
    @MethodSource("valueKeysetsInEachFetchDirection")
    void findTicketsWithCursor_keysetWithValue_continuesPastTheValueInFetchDirectionWithoutReadingARow(
            KeysetCursor cursor, boolean backward, Document expectedKeyset, int order) {
        // setup
        Query unfiltered = new Query();
        String sortField = cursor.sortField();
        String sortDirection = cursor.direction().name();

        // execution
        repository.findTicketsWithCursor(unfiltered, cursor, backward, FETCH_LIMIT, sortField, sortDirection);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Ticket.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject().getList(AND_OPERATOR, Document.class)).containsExactly(expectedKeyset);
        assertThat(query.getSortObject())
                .containsExactlyEntriesOf(new Document(sortField, order).append(ID_FIELD, order));
        assertThat(query.getLimit()).isEqualTo(FETCH_LIMIT);
        verify(mongoTemplate, never()).findOne(any(Query.class), eq(Ticket.class));
        verify(mongoTemplate, never()).findById(any(Object.class), eq(Ticket.class));
    }

    @ParameterizedTest
    @MethodSource("nullKeysetsFetchedAscending")
    void findTicketsWithCursor_nullValueKeysetFetchedAscending_restOfTheNullGroupThenEveryValue(
            KeysetCursor cursor, boolean backward) {
        // setup
        Query unfiltered = new Query();
        String sortField = cursor.sortField();
        String sortDirection = cursor.direction().name();
        Document restOfNullGroup = new Document(sortField, null).append(ID_FIELD, new Document(GREATER, CURSOR_ID));
        Document everyValue = new Document(sortField, new Document(NOT_EQUAL, null));
        Document expectedKeyset = new Document(OR_OPERATOR, List.of(restOfNullGroup, everyValue));

        // execution
        repository.findTicketsWithCursor(unfiltered, cursor, backward, FETCH_LIMIT, sortField, sortDirection);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Ticket.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject().getList(AND_OPERATOR, Document.class)).containsExactly(expectedKeyset);
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(sortField, 1).append(ID_FIELD, 1));
    }

    @ParameterizedTest
    @MethodSource("nullKeysetsFetchedDescending")
    void findTicketsWithCursor_nullValueKeysetFetchedDescending_onlyTheRestOfTheNullGroup(
            KeysetCursor cursor, boolean backward) {
        // setup
        Query unfiltered = new Query();
        String sortField = cursor.sortField();
        String sortDirection = cursor.direction().name();
        Document restOfNullGroup = new Document(sortField, null).append(ID_FIELD, new Document(LESS, CURSOR_ID));

        // execution
        repository.findTicketsWithCursor(unfiltered, cursor, backward, FETCH_LIMIT, sortField, sortDirection);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Ticket.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject().getList(AND_OPERATOR, Document.class)).containsExactly(restOfNullGroup);
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(sortField, -1).append(ID_FIELD, -1));
    }

    @ParameterizedTest
    @MethodSource("fetchDirections")
    void findTicketsWithCursor_idSortKeyset_continuesPastTheIdInFetchDirection(
            Sort.Direction direction, boolean backward, String operator, int order) {
        // setup
        Query unfiltered = new Query();
        KeysetCursor cursor = new KeysetCursor(ID_FIELD, direction, "", CURSOR_HEX);
        Document pastId = new Document(ID_FIELD, new Document(operator, CURSOR_ID));

        // execution
        repository.findTicketsWithCursor(unfiltered, cursor, backward, FETCH_LIMIT, ID_FIELD, direction.name());

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Ticket.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject().getList(AND_OPERATOR, Document.class)).containsExactly(pastId);
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(ID_FIELD, order));
    }

    @ParameterizedTest
    @MethodSource("fetchDirections")
    void findTicketsWithCursor_rowIdUnderIdSort_completePositionWithoutReadingTheRow(
            Sort.Direction direction, boolean backward, String operator, int order) {
        // setup
        Query unfiltered = new Query();
        CursorPosition rowId = new CursorPosition.RowId(CURSOR_HEX);
        Document pastId = new Document(ID_FIELD, new Document(operator, CURSOR_ID));

        // execution
        repository.findTicketsWithCursor(unfiltered, rowId, backward, FETCH_LIMIT, ID_FIELD, direction.name());

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Ticket.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject().getList(AND_OPERATOR, Document.class)).containsExactly(pastId);
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(ID_FIELD, order));
        verify(mongoTemplate, never()).findOne(any(Query.class), eq(Ticket.class));
        verify(mongoTemplate, never()).findById(any(Object.class), eq(Ticket.class));
    }

    @ParameterizedTest
    @MethodSource("valueSorts")
    void findTicketsWithCursor_rowIdUnderAValueSort_readsTheRowOnceWithAScopedQueryAndUsesItsCurrentValue(
            String sortField) {
        // setup
        Query unfiltered = new Query();
        CursorPosition rowId = new CursorPosition.RowId(CURSOR_HEX);
        Ticket row = ticket();
        Document expectedKeyset = keysetPastValue(sortField, GREATER, false);
        when(mongoTemplate.findOne(any(Query.class), eq(Ticket.class))).thenReturn(row);

        // execution
        repository.findTicketsWithCursor(unfiltered, rowId, false, FETCH_LIMIT, sortField, ASC);

        // verifications
        verify(mongoTemplate).findOne(queryCaptor.capture(), eq(Ticket.class));
        assertThat(queryCaptor.getValue().getQueryObject()).containsExactlyEntriesOf(new Document(ID_FIELD, CURSOR_ID));
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Ticket.class));
        assertThat(queryCaptor.getValue().getQueryObject().getList(AND_OPERATOR, Document.class))
                .containsExactly(expectedKeyset);
        verify(mongoTemplate, never()).findById(any(Object.class), eq(Ticket.class));
    }

    @ParameterizedTest
    @MethodSource("valueSorts")
    void findTicketsWithCursor_rowIdBackwardUnderAValueSort_flipsTheComparisonOnTheRowsValue(String sortField) {
        // setup
        Query unfiltered = new Query();
        CursorPosition rowId = new CursorPosition.RowId(CURSOR_HEX);
        Ticket row = ticket();
        Document expectedKeyset = keysetPastValue(sortField, LESS, true);
        when(mongoTemplate.findOne(any(Query.class), eq(Ticket.class))).thenReturn(row);

        // execution
        repository.findTicketsWithCursor(unfiltered, rowId, true, FETCH_LIMIT, sortField, ASC);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Ticket.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject().getList(AND_OPERATOR, Document.class)).containsExactly(expectedKeyset);
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(sortField, -1).append(ID_FIELD, -1));
    }

    @ParameterizedTest
    @MethodSource("valueSorts")
    void findTicketsWithCursor_rowIdOfARowWithoutAValue_continuesInsideTheNullGroup(String sortField) {
        // setup
        Query unfiltered = new Query();
        CursorPosition rowId = new CursorPosition.RowId(CURSOR_HEX);
        Ticket row = Ticket.builder().id(CURSOR_HEX).build();
        Document restOfNullGroup = new Document(sortField, null).append(ID_FIELD, new Document(LESS, CURSOR_ID));
        when(mongoTemplate.findOne(any(Query.class), eq(Ticket.class))).thenReturn(row);

        // execution
        repository.findTicketsWithCursor(unfiltered, rowId, false, FETCH_LIMIT, sortField, DESC);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Ticket.class));
        assertThat(queryCaptor.getValue().getQueryObject().getList(AND_OPERATOR, Document.class))
                .containsExactly(restOfNullGroup);
    }

    @ParameterizedTest
    @MethodSource("fetchDirections")
    void findTicketsWithCursor_rowIdOfAMissingRowUnderTheCreatedAtSort_continuesPastTheIdInFetchDirection(
            Sort.Direction direction, boolean backward, String operator, int order) {
        // setup
        Query unfiltered = new Query();
        CursorPosition rowId = new CursorPosition.RowId(CURSOR_HEX);
        Document pastId = new Document(ID_FIELD, new Document(operator, CURSOR_ID));
        when(mongoTemplate.findOne(any(Query.class), eq(Ticket.class))).thenReturn(null);

        // execution
        repository.findTicketsWithCursor(unfiltered, rowId, backward, FETCH_LIMIT, CREATED_AT, direction.name());

        // verifications
        verify(mongoTemplate).findOne(queryCaptor.capture(), eq(Ticket.class));
        assertThat(queryCaptor.getValue().getQueryObject()).containsExactlyEntriesOf(new Document(ID_FIELD, CURSOR_ID));
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Ticket.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject().getList(AND_OPERATOR, Document.class)).containsExactly(pastId);
        assertThat(query.getSortObject())
                .containsExactlyEntriesOf(new Document(CREATED_AT, order).append(ID_FIELD, order));
        assertThat(query.getLimit()).isEqualTo(FETCH_LIMIT);
        verify(mongoTemplate, never()).findById(any(Object.class), eq(Ticket.class));
    }

    @ParameterizedTest
    @MethodSource("valueSortsOtherThanCreatedAtInEachFetchDirection")
    void findTicketsWithCursor_rowIdOfAMissingRowUnderAnotherValueSort_throwsInvalidCursor(
            String sortField, String sortDirection, boolean backward) {
        // setup
        Query unfiltered = new Query();
        CursorPosition rowId = new CursorPosition.RowId(CURSOR_HEX);
        when(mongoTemplate.findOne(any(Query.class), eq(Ticket.class))).thenReturn(null);

        // execution
        Throwable thrown = catchThrowable(() -> repository.findTicketsWithCursor(
                unfiltered, rowId, backward, FETCH_LIMIT, sortField, sortDirection));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verify(mongoTemplate, never()).find(any(Query.class), eq(Ticket.class));
        verify(mongoTemplate, never()).findById(any(Object.class), eq(Ticket.class));
    }

    @ParameterizedTest
    @CsvSource({
            "assignedName, DESC",
            "organizationName, ASC",
            "createdAt, ASC",
            "ticketNumber, ASC",
            "_id, ASC"
    })
    void findTicketsWithCursor_keysetIssuedUnderAnotherSortFieldOrDirection_throwsInvalidCursor(
            String sortField, String sortDirection) {
        // setup
        Query unfiltered = new Query();
        KeysetCursor assignedNameAscending =
                KeysetCursor.ofString(ASSIGNED_NAME, Sort.Direction.ASC, CURSOR_ASSIGNED_NAME, CURSOR_HEX);

        // execution
        Throwable thrown = catchThrowable(() -> repository.findTicketsWithCursor(
                unfiltered, assignedNameAscending, false, FETCH_LIMIT, sortField, sortDirection));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verify(mongoTemplate, never()).find(any(Query.class), eq(Ticket.class));
    }

    @ParameterizedTest
    @MethodSource("unreadableTicketPositions")
    void findTicketsWithCursor_positionThatIsNotATicketPosition_throwsInvalidCursor(
            CursorPosition position, String sortField) {
        // setup
        Query unfiltered = new Query();

        // execution
        Throwable thrown = catchThrowable(() -> repository.findTicketsWithCursor(
                unfiltered, position, false, FETCH_LIMIT, sortField, ASC));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verify(mongoTemplate, never()).find(any(Query.class), eq(Ticket.class));
        verify(mongoTemplate, never()).findOne(any(Query.class), eq(Ticket.class));
        verify(mongoTemplate, never()).findById(any(Object.class), eq(Ticket.class));
    }

    @Test
    void findTicketsWithCursor_idRestrictionWithAKeysetBackward_keepsTheRestrictionNextToTheFlippedKeyset() {
        // setup
        List<String> ticketIds = List.of("ticket-1", "ticket-2");
        Query filtered = repository.buildTicketQuery(null, null, ticketIds, null);
        KeysetCursor cursor = new KeysetCursor(ID_FIELD, Sort.Direction.DESC, "", CURSOR_HEX);
        Document pastId = new Document(ID_FIELD, new Document(GREATER, CURSOR_ID));

        // execution
        repository.findTicketsWithCursor(filtered, cursor, true, FETCH_LIMIT, ID_FIELD, DESC);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Ticket.class));
        Document executed = queryCaptor.getValue().getQueryObject();
        assertThat(executed).containsEntry(ID_FIELD, new Document("$in", ticketIds));
        assertThat(executed.getList(AND_OPERATOR, Document.class)).containsExactly(pastId);
    }

    @ParameterizedTest
    @MethodSource("ticketsPerSort")
    void keysetCursor_eachSort_carriesTheSortFieldDirectionValueAndId(
            String sortField, Sort.Direction direction, Ticket ticket, String expectedPayload) {
        // setup
        String sortDirection = direction.name();

        // execution
        KeysetCursor cursor = repository.keysetCursor(ticket, sortField, sortDirection);

        // verifications
        assertThat(CursorBase64.decode(cursor.encode())).isEqualTo(expectedPayload);
        assertThat(cursor.id()).isEqualTo(CURSOR_HEX);
    }

    @ParameterizedTest
    @MethodSource("valueKeysetsInBothDirections")
    void keysetCursor_encodedAndParsedBack_thePositionTheRepositoryAccepts(KeysetCursor expected) {
        // setup
        Ticket row = ticket();
        String sortField = expected.sortField();
        String sortDirection = expected.direction().name();

        // execution
        KeysetCursor issued = repository.keysetCursor(row, sortField, sortDirection);

        // verifications
        assertThat(KeysetCursor.parse(issued.encode())).isEqualTo(expected);
    }

    private Document captureExecutedQuery() {
        ArgumentCaptor<Query> captor = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).find(captor.capture(), eq(Ticket.class));
        return captor.getValue().getQueryObject();
    }

    private Document cursorBoundOf(Document executed) {
        List<?> conjuncts = executed.getList(AND_OPERATOR, Object.class);
        assertThat(conjuncts).hasSize(1);
        return (Document) conjuncts.get(0);
    }

    private static Stream<String> valueSorts() {
        return VALUE_SORTS.stream();
    }

    private static Stream<Arguments> valueSortsInEachFetchDirection() {
        return VALUE_SORTS.stream().flatMap(sortField -> Stream.of(
                arguments(sortField, ASC, false, 1),
                arguments(sortField, ASC, true, -1),
                arguments(sortField, DESC, false, -1),
                arguments(sortField, DESC, true, 1)));
    }

    private static Stream<Arguments> valueSortsOtherThanCreatedAtInEachFetchDirection() {
        return VALUE_SORTS.stream()
                .filter(sortField -> !CREATED_AT.equals(sortField))
                .flatMap(sortField -> Stream.of(
                        arguments(sortField, ASC, false),
                        arguments(sortField, ASC, true),
                        arguments(sortField, DESC, false),
                        arguments(sortField, DESC, true)));
    }

    private static Stream<Arguments> fetchDirections() {
        return Stream.of(
                arguments(Sort.Direction.ASC, false, GREATER, 1),
                arguments(Sort.Direction.ASC, true, LESS, -1),
                arguments(Sort.Direction.DESC, false, LESS, -1),
                arguments(Sort.Direction.DESC, true, GREATER, 1));
    }

    private static Stream<Arguments> valueKeysetsInEachFetchDirection() {
        return VALUE_SORTS.stream().flatMap(sortField -> Stream.of(
                arguments(valueKeyset(sortField, Sort.Direction.ASC), false,
                        keysetPastValue(sortField, GREATER, false), 1),
                arguments(valueKeyset(sortField, Sort.Direction.ASC), true,
                        keysetPastValue(sortField, LESS, true), -1),
                arguments(valueKeyset(sortField, Sort.Direction.DESC), false,
                        keysetPastValue(sortField, LESS, true), -1),
                arguments(valueKeyset(sortField, Sort.Direction.DESC), true,
                        keysetPastValue(sortField, GREATER, false), 1)));
    }

    private static Stream<KeysetCursor> valueKeysetsInBothDirections() {
        return VALUE_SORTS.stream().flatMap(sortField -> Stream.of(
                valueKeyset(sortField, Sort.Direction.ASC),
                valueKeyset(sortField, Sort.Direction.DESC)));
    }

    private static Stream<Arguments> nullKeysetsFetchedAscending() {
        return VALUE_SORTS.stream().flatMap(sortField -> Stream.of(
                arguments(nullKeyset(sortField, Sort.Direction.ASC), false),
                arguments(nullKeyset(sortField, Sort.Direction.DESC), true)));
    }

    private static Stream<Arguments> nullKeysetsFetchedDescending() {
        return VALUE_SORTS.stream().flatMap(sortField -> Stream.of(
                arguments(nullKeyset(sortField, Sort.Direction.DESC), false),
                arguments(nullKeyset(sortField, Sort.Direction.ASC), true)));
    }

    private static Stream<Arguments> unreadableTicketPositions() {
        String notBase64 = "%%%";
        return Stream.of(
                arguments(new CursorPosition.Unrecognised("not-a-cursor"), ID_FIELD),
                arguments(new CursorPosition.Unrecognised("not-a-cursor"), CREATED_AT),
                arguments(new CursorPosition.Unrecognised(CURSOR_ASSIGNED_NAME + "|" + CURSOR_HEX), ASSIGNED_NAME),
                arguments(new CursorPosition.RowId(NOT_AN_OBJECT_ID), ID_FIELD),
                arguments(new CursorPosition.RowId(NOT_AN_OBJECT_ID), CREATED_AT),
                arguments(new KeysetCursor(ID_FIELD, Sort.Direction.ASC, "", NOT_AN_OBJECT_ID), ID_FIELD),
                arguments(KeysetCursor.ofString(ASSIGNED_NAME, Sort.Direction.ASC, CURSOR_ASSIGNED_NAME,
                        NOT_AN_OBJECT_ID), ASSIGNED_NAME),
                arguments(new KeysetCursor(TICKET_NUMBER, Sort.Direction.ASC, "forty-two", CURSOR_HEX), TICKET_NUMBER),
                arguments(new KeysetCursor(STATUS_KIND, Sort.Direction.ASC, notBase64, CURSOR_HEX), STATUS_KIND),
                arguments(new KeysetCursor(ORGANIZATION_NAME, Sort.Direction.ASC, notBase64, CURSOR_HEX),
                        ORGANIZATION_NAME),
                arguments(new KeysetCursor(ASSIGNED_NAME, Sort.Direction.ASC, notBase64, CURSOR_HEX), ASSIGNED_NAME),
                arguments(new KeysetCursor(DEVICE_HOSTNAME, Sort.Direction.ASC, notBase64, CURSOR_HEX),
                        DEVICE_HOSTNAME),
                arguments(new KeysetCursor(ORDER, Sort.Direction.ASC, notBase64, CURSOR_HEX), ORDER),
                arguments(new KeysetCursor(CREATED_AT, Sort.Direction.ASC, "yesterday", CURSOR_HEX), CREATED_AT),
                arguments(new KeysetCursor(UPDATED_AT, Sort.Direction.ASC, "yesterday", CURSOR_HEX), UPDATED_AT),
                arguments(new KeysetCursor(RESOLVED_AT, Sort.Direction.ASC, "yesterday", CURSOR_HEX), RESOLVED_AT),
                arguments(new KeysetCursor(LAST_ACTIVITY_AT, Sort.Direction.ASC, "yesterday", CURSOR_HEX),
                        LAST_ACTIVITY_AT));
    }

    private static Stream<Arguments> ticketsPerSort() {
        Ticket ticket = ticket();
        Ticket blank = Ticket.builder().id(CURSOR_HEX).build();
        String idSuffix = "|" + CURSOR_HEX;
        Stream<Arguments> valued = Stream.of(
                arguments(TICKET_NUMBER, Sort.Direction.ASC, ticket, "k1|ticketNumber|ASC|4217" + idSuffix),
                arguments(STATUS_KIND, Sort.Direction.DESC, ticket,
                        "k1|statusKind|DESC|" + base64(CURSOR_STATUS_KIND.name()) + idSuffix),
                arguments(ORGANIZATION_NAME, Sort.Direction.ASC, ticket,
                        "k1|organizationName|ASC|" + base64(CURSOR_ORGANIZATION_NAME) + idSuffix),
                arguments(ASSIGNED_NAME, Sort.Direction.DESC, ticket,
                        "k1|assignedName|DESC|" + base64(CURSOR_ASSIGNED_NAME) + idSuffix),
                arguments(DEVICE_HOSTNAME, Sort.Direction.ASC, ticket,
                        "k1|deviceHostname|ASC|" + base64(CURSOR_DEVICE_HOSTNAME) + idSuffix),
                arguments(ORDER, Sort.Direction.ASC, ticket, "k1|order|ASC|" + base64(CURSOR_ORDER) + idSuffix),
                arguments(CREATED_AT, Sort.Direction.DESC, ticket,
                        "k1|createdAt|DESC|" + CURSOR_CREATED_AT.toEpochMilli() + idSuffix),
                arguments(UPDATED_AT, Sort.Direction.ASC, ticket,
                        "k1|updatedAt|ASC|" + CURSOR_UPDATED_AT.toEpochMilli() + idSuffix),
                arguments(RESOLVED_AT, Sort.Direction.DESC, ticket,
                        "k1|resolvedAt|DESC|" + CURSOR_RESOLVED_AT.toEpochMilli() + idSuffix),
                arguments(LAST_ACTIVITY_AT, Sort.Direction.ASC, ticket,
                        "k1|lastActivityAt|ASC|" + CURSOR_LAST_ACTIVITY_AT.toEpochMilli() + idSuffix),
                arguments(ID_FIELD, Sort.Direction.DESC, ticket, "k1|_id|DESC|" + idSuffix),
                arguments(ID_FIELD, Sort.Direction.ASC, ticket, "k1|_id|ASC|" + idSuffix));
        Stream<Arguments> withoutAValue = VALUE_SORTS.stream()
                .map(sortField -> arguments(sortField, Sort.Direction.DESC, blank,
                        "k1|" + sortField + "|DESC|" + idSuffix));
        return Stream.concat(valued, withoutAValue);
    }

    private static Ticket ticket() {
        return Ticket.builder()
                .id(CURSOR_HEX)
                .ticketNumber(CURSOR_TICKET_NUMBER)
                .statusKind(CURSOR_STATUS_KIND)
                .organizationName(CURSOR_ORGANIZATION_NAME)
                .assignedName(CURSOR_ASSIGNED_NAME)
                .deviceHostname(CURSOR_DEVICE_HOSTNAME)
                .order(CURSOR_ORDER)
                .createdAt(CURSOR_CREATED_AT)
                .updatedAt(CURSOR_UPDATED_AT)
                .resolvedAt(CURSOR_RESOLVED_AT)
                .lastActivityAt(CURSOR_LAST_ACTIVITY_AT)
                .build();
    }

    private static Object valueOf(String sortField) {
        return switch (sortField) {
            case TICKET_NUMBER -> CURSOR_TICKET_NUMBER;
            case STATUS_KIND -> CURSOR_STATUS_KIND.name();
            case ORGANIZATION_NAME -> CURSOR_ORGANIZATION_NAME;
            case ASSIGNED_NAME -> CURSOR_ASSIGNED_NAME;
            case DEVICE_HOSTNAME -> CURSOR_DEVICE_HOSTNAME;
            case ORDER -> CURSOR_ORDER;
            case CREATED_AT -> CURSOR_CREATED_AT;
            case UPDATED_AT -> CURSOR_UPDATED_AT;
            case RESOLVED_AT -> CURSOR_RESOLVED_AT;
            case LAST_ACTIVITY_AT -> CURSOR_LAST_ACTIVITY_AT;
            default -> throw new IllegalArgumentException("No test value for the " + sortField + " sort");
        };
    }

    private static KeysetCursor valueKeyset(String sortField, Sort.Direction direction) {
        Object value = valueOf(sortField);
        return switch (value) {
            case Instant instant -> KeysetCursor.ofInstant(sortField, direction, instant, CURSOR_HEX);
            case Integer number -> new KeysetCursor(sortField, direction, number.toString(), CURSOR_HEX);
            default -> KeysetCursor.ofString(sortField, direction, value.toString(), CURSOR_HEX);
        };
    }

    private static KeysetCursor nullKeyset(String sortField, Sort.Direction direction) {
        return new KeysetCursor(sortField, direction, "", CURSOR_HEX);
    }

    private static Document keysetPastValue(String sortField, String operator, boolean nullGroupAhead) {
        Object value = valueOf(sortField);
        Document pastValue = new Document(sortField, new Document(operator, value));
        Document sameValuePastId = new Document(sortField, value).append(ID_FIELD, new Document(operator, CURSOR_ID));
        Document nullGroup = new Document(sortField, null);
        List<Document> branches = nullGroupAhead
                ? List.of(pastValue, sameValuePastId, nullGroup)
                : List.of(pastValue, sameValuePastId);
        return new Document(OR_OPERATOR, branches);
    }

    private static String base64(String text) {
        return Base64.getEncoder().encodeToString(text.getBytes(StandardCharsets.UTF_8));
    }
}
