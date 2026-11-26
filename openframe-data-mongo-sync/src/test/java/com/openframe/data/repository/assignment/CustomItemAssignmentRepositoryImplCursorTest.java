package com.openframe.data.repository.assignment;

import com.openframe.core.exception.InvalidCursorException;
import com.openframe.data.document.assignment.AssignmentTargetType;
import com.openframe.data.document.assignment.ItemAssignment;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
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
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
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
class CustomItemAssignmentRepositoryImplCursorTest {

    private static final String ID = "_id";
    private static final String ITEM_ID_FIELD = "itemId";
    private static final String TARGET_TYPE_FIELD = "targetType";
    private static final String DISPLAY_NAME = "displayName";
    private static final String CREATED_AT = "createdAt";
    private static final String AND = "$and";
    private static final String OR = "$or";
    private static final String GREATER = "$gt";
    private static final String LESS = "$lt";
    private static final String ASC = "ASC";
    private static final String DESC = "DESC";
    private static final String INVALID_CURSOR = "Invalid cursor";
    private static final String ITEM_ID = "item-1";
    private static final AssignmentTargetType TARGET_TYPE = AssignmentTargetType.DEVICE;
    private static final String CURSOR_HEX = "65f1a2b3c4d5e6f708192a3b";
    private static final ObjectId CURSOR_ID = new ObjectId(CURSOR_HEX);
    private static final String CURSOR_NAME = "ws-042";
    private static final Instant CURSOR_INSTANT = Instant.ofEpochMilli(1_700_000_000_123L);
    private static final int FETCH_LIMIT = 11;

    @Mock private TenantAwareMongoTemplate mongoTemplate;
    @Captor private ArgumentCaptor<Query> queryCaptor;
    @InjectMocks private CustomItemAssignmentRepositoryImpl repository;

    @ParameterizedTest
    @MethodSource("valueSortsInEachFetchDirection")
    void findAssignmentsWithCursor_valueSortWithoutPosition_sortsByFieldThenIdInFetchDirection(
            String sortField, String direction, boolean backward, int order) {
        // setup
        CursorPosition noPosition = new CursorPosition.None();

        // execution
        repository.findAssignmentsWithCursor(
                ITEM_ID, TARGET_TYPE, null, sortField, direction, noPosition, backward, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(ItemAssignment.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(sortField, order).append(ID, order));
        assertThat(query.getLimit()).isEqualTo(FETCH_LIMIT);
        assertThat(query.getQueryObject())
                .containsEntry(ITEM_ID_FIELD, ITEM_ID)
                .containsEntry(TARGET_TYPE_FIELD, TARGET_TYPE)
                .doesNotContainKeys(AND, OR, ID);
    }

    @ParameterizedTest
    @MethodSource("fetchDirections")
    void findAssignmentsWithCursor_idSortWithoutPosition_sortsByIdInFetchDirection(
            String direction, boolean backward, String operator, int order) {
        // setup
        CursorPosition noPosition = new CursorPosition.None();

        // execution
        repository.findAssignmentsWithCursor(ITEM_ID, TARGET_TYPE, null, ID, direction, noPosition, backward, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(ItemAssignment.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(ID, order));
        assertThat(query.getQueryObject()).doesNotContainKeys(AND, OR, ID);
    }

    @ParameterizedTest
    @MethodSource("valueKeysetsInEachFetchDirection")
    void findAssignmentsWithCursor_keysetWithValue_continuesPastTheValueInFetchDirection(
            KeysetCursor cursor, boolean backward, Document expectedKeyset, int order) {
        // setup
        String sortField = cursor.sortField();
        String direction = cursor.direction().name();

        // execution
        repository.findAssignmentsWithCursor(ITEM_ID, TARGET_TYPE, null, sortField, direction, cursor, backward, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(ItemAssignment.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject())
                .containsEntry(ITEM_ID_FIELD, ITEM_ID)
                .containsEntry(TARGET_TYPE_FIELD, TARGET_TYPE);
        assertThat(query.getQueryObject().getList(AND, Document.class)).containsExactly(expectedKeyset);
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(sortField, order).append(ID, order));
        verify(mongoTemplate, never()).findOne(any(Query.class), eq(ItemAssignment.class));
    }

    @ParameterizedTest
    @MethodSource("nullKeysetsFetchedAscending")
    void findAssignmentsWithCursor_nullValueKeysetFetchedAscending_restOfTheNullGroupThenEveryValue(
            KeysetCursor cursor, boolean backward) {
        // setup
        String sortField = cursor.sortField();
        String direction = cursor.direction().name();
        Document restOfNullGroup = new Document(sortField, null).append(ID, new Document(GREATER, CURSOR_ID));
        Document everyValue = new Document(sortField, new Document("$ne", null));
        Document expectedKeyset = new Document(OR, List.of(restOfNullGroup, everyValue));

        // execution
        repository.findAssignmentsWithCursor(ITEM_ID, TARGET_TYPE, null, sortField, direction, cursor, backward, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(ItemAssignment.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject().getList(AND, Document.class)).containsExactly(expectedKeyset);
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(sortField, 1).append(ID, 1));
    }

    @ParameterizedTest
    @MethodSource("nullKeysetsFetchedDescending")
    void findAssignmentsWithCursor_nullValueKeysetFetchedDescending_onlyTheRestOfTheNullGroup(
            KeysetCursor cursor, boolean backward) {
        // setup
        String sortField = cursor.sortField();
        String direction = cursor.direction().name();
        Document restOfNullGroup = new Document(sortField, null).append(ID, new Document(LESS, CURSOR_ID));

        // execution
        repository.findAssignmentsWithCursor(ITEM_ID, TARGET_TYPE, null, sortField, direction, cursor, backward, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(ItemAssignment.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject().getList(AND, Document.class)).containsExactly(restOfNullGroup);
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(sortField, -1).append(ID, -1));
    }

    @ParameterizedTest
    @MethodSource("fetchDirections")
    void findAssignmentsWithCursor_idSortKeyset_continuesPastTheIdInFetchDirection(
            String direction, boolean backward, String operator, int order) {
        // setup
        KeysetCursor cursor = new KeysetCursor(ID, Sort.Direction.valueOf(direction), "", CURSOR_HEX);
        Document pastId = new Document(ID, new Document(operator, CURSOR_ID));

        // execution
        repository.findAssignmentsWithCursor(ITEM_ID, TARGET_TYPE, null, ID, direction, cursor, backward, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(ItemAssignment.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject().getList(AND, Document.class)).containsExactly(pastId);
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(ID, order));
    }

    @ParameterizedTest
    @MethodSource("fetchDirections")
    void findAssignmentsWithCursor_rowIdUnderIdSort_completePositionWithoutReadingTheRow(
            String direction, boolean backward, String operator, int order) {
        // setup
        CursorPosition rowId = new CursorPosition.RowId(CURSOR_HEX);
        Document pastId = new Document(ID, new Document(operator, CURSOR_ID));

        // execution
        repository.findAssignmentsWithCursor(ITEM_ID, TARGET_TYPE, null, ID, direction, rowId, backward, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(ItemAssignment.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject().getList(AND, Document.class)).containsExactly(pastId);
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(ID, order));
        verify(mongoTemplate, never()).findOne(any(Query.class), eq(ItemAssignment.class));
        verify(mongoTemplate, never()).findById(any(Object.class), eq(ItemAssignment.class));
    }

    @ParameterizedTest
    @MethodSource("rowsPerValueSort")
    void findAssignmentsWithCursor_rowIdUnderAValueSort_readsTheRowOnceWithAQueryAndUsesItsCurrentValue(
            String sortField, ItemAssignment row, Object currentValue) {
        // setup
        CursorPosition rowId = new CursorPosition.RowId(CURSOR_HEX);
        Document expectedKeyset = keysetPastValue(sortField, currentValue, GREATER, false);
        when(mongoTemplate.findOne(any(Query.class), eq(ItemAssignment.class))).thenReturn(row);

        // execution
        repository.findAssignmentsWithCursor(ITEM_ID, TARGET_TYPE, null, sortField, ASC, rowId, false, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).findOne(queryCaptor.capture(), eq(ItemAssignment.class));
        assertThat(queryCaptor.getValue().getQueryObject()).containsExactlyEntriesOf(new Document(ID, CURSOR_ID));
        verify(mongoTemplate).find(queryCaptor.capture(), eq(ItemAssignment.class));
        assertThat(queryCaptor.getValue().getQueryObject().getList(AND, Document.class)).containsExactly(expectedKeyset);
        verify(mongoTemplate, never()).findById(any(Object.class), eq(ItemAssignment.class));
    }

    @Test
    void findAssignmentsWithCursor_rowIdBackwardUnderTheDefaultSort_flipsTheComparisonOnTheRowsValue() {
        // setup
        CursorPosition rowId = new CursorPosition.RowId(CURSOR_HEX);
        ItemAssignment row = assignment();
        Document expectedKeyset = keysetPastValue(CREATED_AT, CURSOR_INSTANT, GREATER, false);
        when(mongoTemplate.findOne(any(Query.class), eq(ItemAssignment.class))).thenReturn(row);

        // execution
        repository.findAssignmentsWithCursor(ITEM_ID, TARGET_TYPE, null, CREATED_AT, DESC, rowId, true, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(ItemAssignment.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject().getList(AND, Document.class)).containsExactly(expectedKeyset);
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(CREATED_AT, 1).append(ID, 1));
    }

    @ParameterizedTest
    @ValueSource(strings = {DISPLAY_NAME, CREATED_AT})
    void findAssignmentsWithCursor_rowIdOfARowWithoutAValue_continuesInsideTheNullGroup(String sortField) {
        // setup
        CursorPosition rowId = new CursorPosition.RowId(CURSOR_HEX);
        ItemAssignment row = ItemAssignment.builder().id(CURSOR_HEX).build();
        Document restOfNullGroup = new Document(sortField, null).append(ID, new Document(LESS, CURSOR_ID));
        when(mongoTemplate.findOne(any(Query.class), eq(ItemAssignment.class))).thenReturn(row);

        // execution
        repository.findAssignmentsWithCursor(ITEM_ID, TARGET_TYPE, null, sortField, DESC, rowId, false, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(ItemAssignment.class));
        assertThat(queryCaptor.getValue().getQueryObject().getList(AND, Document.class))
                .containsExactly(restOfNullGroup);
    }

    @ParameterizedTest
    @MethodSource("fetchDirections")
    void findAssignmentsWithCursor_rowIdOfAMissingRowUnderTheCreatedAtSort_continuesPastTheIdInFetchDirection(
            String direction, boolean backward, String operator, int order) {
        // setup
        CursorPosition rowId = new CursorPosition.RowId(CURSOR_HEX);
        Document pastId = new Document(ID, new Document(operator, CURSOR_ID));
        when(mongoTemplate.findOne(any(Query.class), eq(ItemAssignment.class))).thenReturn(null);

        // execution
        repository.findAssignmentsWithCursor(
                ITEM_ID, TARGET_TYPE, null, CREATED_AT, direction, rowId, backward, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).findOne(queryCaptor.capture(), eq(ItemAssignment.class));
        assertThat(queryCaptor.getValue().getQueryObject()).containsExactlyEntriesOf(new Document(ID, CURSOR_ID));
        verify(mongoTemplate).find(queryCaptor.capture(), eq(ItemAssignment.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject())
                .containsEntry(ITEM_ID_FIELD, ITEM_ID)
                .containsEntry(TARGET_TYPE_FIELD, TARGET_TYPE);
        assertThat(query.getQueryObject().getList(AND, Document.class)).containsExactly(pastId);
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(CREATED_AT, order).append(ID, order));
        assertThat(query.getLimit()).isEqualTo(FETCH_LIMIT);
        verify(mongoTemplate, never()).findById(any(Object.class), eq(ItemAssignment.class));
    }

    @ParameterizedTest
    @CsvSource({
            "ASC, false",
            "ASC, true",
            "DESC, false",
            "DESC, true"
    })
    void findAssignmentsWithCursor_rowIdOfAMissingRowUnderTheDisplayNameSort_throwsInvalidCursor(
            String direction, boolean backward) {
        // setup
        CursorPosition rowId = new CursorPosition.RowId(CURSOR_HEX);
        when(mongoTemplate.findOne(any(Query.class), eq(ItemAssignment.class))).thenReturn(null);

        // execution
        Throwable thrown = catchThrowable(() -> repository.findAssignmentsWithCursor(
                ITEM_ID, TARGET_TYPE, null, DISPLAY_NAME, direction, rowId, backward, FETCH_LIMIT));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verify(mongoTemplate, never()).find(any(Query.class), eq(ItemAssignment.class));
        verify(mongoTemplate, never()).findById(any(Object.class), eq(ItemAssignment.class));
    }

    @ParameterizedTest
    @CsvSource({
            "displayName, DESC",
            "createdAt, ASC",
            "createdAt, DESC",
            "_id, ASC"
    })
    void findAssignmentsWithCursor_keysetIssuedUnderAnotherSortFieldOrDirection_throwsInvalidCursor(
            String sortField, String direction) {
        // setup
        KeysetCursor nameAscending = KeysetCursor.ofString(DISPLAY_NAME, Sort.Direction.ASC, CURSOR_NAME, CURSOR_HEX);

        // execution
        Throwable thrown = catchThrowable(() -> repository.findAssignmentsWithCursor(
                ITEM_ID, TARGET_TYPE, null, sortField, direction, nameAscending, false, FETCH_LIMIT));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verify(mongoTemplate, never()).find(any(Query.class), eq(ItemAssignment.class));
    }

    @ParameterizedTest
    @MethodSource("unreadableAssignmentPositions")
    void findAssignmentsWithCursor_positionThatIsNotAnAssignmentPosition_throwsInvalidCursor(
            CursorPosition position, String sortField) {
        // setup
        String direction = ASC;

        // execution
        Throwable thrown = catchThrowable(() -> repository.findAssignmentsWithCursor(
                ITEM_ID, TARGET_TYPE, null, sortField, direction, position, false, FETCH_LIMIT));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verify(mongoTemplate, never()).find(any(Query.class), eq(ItemAssignment.class));
        verify(mongoTemplate, never()).findOne(any(Query.class), eq(ItemAssignment.class));
    }

    @ParameterizedTest
    @MethodSource("displayNameKeysetsNextToASearch")
    void findAssignmentsWithCursor_searchWithADisplayNamePosition_keepsTheSearchNextToTheKeyset(
            KeysetCursor cursor, Document expectedKeyset) {
        // setup
        String direction = cursor.direction().name();

        // execution
        repository.findAssignmentsWithCursor(
                ITEM_ID, TARGET_TYPE, "ws", DISPLAY_NAME, direction, cursor, false, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(ItemAssignment.class));
        Document query = queryCaptor.getValue().getQueryObject();
        assertThat(query)
                .containsEntry(ITEM_ID_FIELD, ITEM_ID)
                .containsKey(DISPLAY_NAME);
        assertThat(query.getList(AND, Document.class)).containsExactly(expectedKeyset);
    }

    @ParameterizedTest
    @MethodSource("assignmentsPerSort")
    void keysetCursor_eachSort_carriesTheSortFieldDirectionValueAndId(
            String sortField, String direction, ItemAssignment assignment, String expectedPayload) {
        // setup
        String assignmentId = assignment.getId();

        // execution
        KeysetCursor cursor = repository.keysetCursor(assignment, sortField, direction);

        // verifications
        assertThat(CursorBase64.decode(cursor.encode())).isEqualTo(expectedPayload);
        assertThat(cursor.id()).isEqualTo(assignmentId);
    }

    private static Stream<Arguments> valueSortsInEachFetchDirection() {
        return Stream.of(DISPLAY_NAME, CREATED_AT).flatMap(sortField -> Stream.of(
                arguments(sortField, ASC, false, 1),
                arguments(sortField, ASC, true, -1),
                arguments(sortField, DESC, false, -1),
                arguments(sortField, DESC, true, 1)));
    }

    private static Stream<Arguments> fetchDirections() {
        return Stream.of(
                arguments(ASC, false, GREATER, 1),
                arguments(ASC, true, LESS, -1),
                arguments(DESC, false, LESS, -1),
                arguments(DESC, true, GREATER, 1));
    }

    private static Stream<Arguments> valueKeysetsInEachFetchDirection() {
        return Stream.of(DISPLAY_NAME, CREATED_AT).flatMap(sortField -> Stream.of(
                arguments(valueKeyset(sortField, Sort.Direction.ASC), false,
                        keysetPastValue(sortField, valueOf(sortField), GREATER, false), 1),
                arguments(valueKeyset(sortField, Sort.Direction.ASC), true,
                        keysetPastValue(sortField, valueOf(sortField), LESS, true), -1),
                arguments(valueKeyset(sortField, Sort.Direction.DESC), false,
                        keysetPastValue(sortField, valueOf(sortField), LESS, true), -1),
                arguments(valueKeyset(sortField, Sort.Direction.DESC), true,
                        keysetPastValue(sortField, valueOf(sortField), GREATER, false), 1)));
    }

    private static Stream<Arguments> nullKeysetsFetchedAscending() {
        return Stream.of(DISPLAY_NAME, CREATED_AT).flatMap(sortField -> Stream.of(
                arguments(nullKeyset(sortField, Sort.Direction.ASC), false),
                arguments(nullKeyset(sortField, Sort.Direction.DESC), true)));
    }

    private static Stream<Arguments> nullKeysetsFetchedDescending() {
        return Stream.of(DISPLAY_NAME, CREATED_AT).flatMap(sortField -> Stream.of(
                arguments(nullKeyset(sortField, Sort.Direction.DESC), false),
                arguments(nullKeyset(sortField, Sort.Direction.ASC), true)));
    }

    private static Stream<Arguments> rowsPerValueSort() {
        ItemAssignment row = assignment();
        return Stream.of(
                arguments(DISPLAY_NAME, row, CURSOR_NAME),
                arguments(CREATED_AT, row, CURSOR_INSTANT));
    }

    private static Stream<Arguments> unreadableAssignmentPositions() {
        String notBase64 = "%%%";
        return Stream.of(
                arguments(new CursorPosition.Unrecognised("not-a-cursor"), ID),
                arguments(new CursorPosition.Unrecognised("not-a-cursor"), CREATED_AT),
                arguments(new CursorPosition.Unrecognised("1700000000123_" + CURSOR_HEX), CREATED_AT),
                arguments(new CursorPosition.RowId("not-an-object-id"), ID),
                arguments(new CursorPosition.RowId("not-an-object-id"), DISPLAY_NAME),
                arguments(new CursorPosition.RowId("not-an-object-id"), CREATED_AT),
                arguments(new KeysetCursor(ID, Sort.Direction.ASC, "", "not-an-object-id"), ID),
                arguments(KeysetCursor.ofString(DISPLAY_NAME, Sort.Direction.ASC, CURSOR_NAME, "not-an-object-id"),
                        DISPLAY_NAME),
                arguments(new KeysetCursor(DISPLAY_NAME, Sort.Direction.ASC, notBase64, CURSOR_HEX), DISPLAY_NAME),
                arguments(new KeysetCursor(CREATED_AT, Sort.Direction.ASC, "yesterday", CURSOR_HEX), CREATED_AT));
    }

    private static Stream<Arguments> displayNameKeysetsNextToASearch() {
        Document restOfNullGroup = new Document(DISPLAY_NAME, null).append(ID, new Document(LESS, CURSOR_ID));
        return Stream.of(
                arguments(valueKeyset(DISPLAY_NAME, Sort.Direction.ASC),
                        keysetPastValue(DISPLAY_NAME, CURSOR_NAME, GREATER, false)),
                arguments(nullKeyset(DISPLAY_NAME, Sort.Direction.DESC), restOfNullGroup));
    }

    private static Stream<Arguments> assignmentsPerSort() {
        ItemAssignment assignment = assignment();
        ItemAssignment blank = ItemAssignment.builder().id(CURSOR_HEX).build();
        String idSuffix = "|" + CURSOR_HEX;
        long createdAtMillis = CURSOR_INSTANT.toEpochMilli();
        return Stream.of(
                arguments(DISPLAY_NAME, ASC, assignment, "k1|displayName|ASC|" + base64(CURSOR_NAME) + idSuffix),
                arguments(CREATED_AT, DESC, assignment, "k1|createdAt|DESC|" + createdAtMillis + idSuffix),
                arguments(ID, DESC, assignment, "k1|_id|DESC|" + idSuffix),
                arguments(DISPLAY_NAME, DESC, blank, "k1|displayName|DESC|" + idSuffix),
                arguments(CREATED_AT, ASC, blank, "k1|createdAt|ASC|" + idSuffix));
    }

    private static ItemAssignment assignment() {
        return ItemAssignment.builder()
                .id(CURSOR_HEX)
                .displayName(CURSOR_NAME)
                .createdAt(CURSOR_INSTANT)
                .build();
    }

    private static Object valueOf(String sortField) {
        return DISPLAY_NAME.equals(sortField) ? CURSOR_NAME : CURSOR_INSTANT;
    }

    private static KeysetCursor valueKeyset(String sortField, Sort.Direction direction) {
        return DISPLAY_NAME.equals(sortField)
                ? KeysetCursor.ofString(sortField, direction, CURSOR_NAME, CURSOR_HEX)
                : KeysetCursor.ofInstant(sortField, direction, CURSOR_INSTANT, CURSOR_HEX);
    }

    private static KeysetCursor nullKeyset(String sortField, Sort.Direction direction) {
        return new KeysetCursor(sortField, direction, "", CURSOR_HEX);
    }

    private static Document keysetPastValue(String sortField, Object value, String operator, boolean nullGroupAhead) {
        Document pastValue = new Document(sortField, new Document(operator, value));
        Document sameValuePastId = new Document(sortField, value).append(ID, new Document(operator, CURSOR_ID));
        Document nullGroup = new Document(sortField, null);
        List<Document> branches = nullGroupAhead
                ? List.of(pastValue, sameValuePastId, nullGroup)
                : List.of(pastValue, sameValuePastId);
        return new Document(OR, branches);
    }

    private static String base64(String text) {
        return Base64.getEncoder().encodeToString(text.getBytes(StandardCharsets.UTF_8));
    }
}
