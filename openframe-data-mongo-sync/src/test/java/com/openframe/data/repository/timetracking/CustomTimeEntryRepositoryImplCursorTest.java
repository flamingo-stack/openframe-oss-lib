package com.openframe.data.repository.timetracking;

import com.openframe.core.exception.InvalidCursorException;
import com.openframe.data.document.timetracking.TimeEntry;
import com.openframe.data.document.timetracking.filter.TimeEntryQueryFilter;
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
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;
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
class CustomTimeEntryRepositoryImplCursorTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String TENANT_FIELD = "tenantId";
    private static final String ID = "_id";
    private static final String DATE = "date";
    private static final String WORK_DAY = "_workDay";
    private static final String STARTED_AT = "startedAt";
    private static final String ENDED_AT = "endedAt";
    private static final String CREATED_AT = "createdAt";
    private static final String UPDATED_AT = "updatedAt";
    private static final String DURATION_SECONDS = "durationSeconds";
    private static final String USER_ID_FIELD = "userId";
    private static final String MATCH = "$match";
    private static final String ADD_FIELDS = "$addFields";
    private static final String SORT = "$sort";
    private static final String LIMIT = "$limit";
    private static final String AND = "$and";
    private static final String OR = "$or";
    private static final String GREATER = "$gt";
    private static final String LESS = "$lt";
    private static final String ASC = "ASC";
    private static final String DESC = "DESC";
    private static final String INVALID_CURSOR = "Invalid cursor";
    private static final String CURSOR_HEX = "65f1a2b3c4d5e6f708192a3b";
    private static final ObjectId CURSOR_ID = new ObjectId(CURSOR_HEX);
    private static final String CURSOR_DAY = "2023-11-14";
    private static final Instant CURSOR_STARTED_AT = Instant.parse("2023-11-14T09:15:00Z");
    private static final Instant CURSOR_ENDED_AT = Instant.parse("2023-11-14T10:15:00Z");
    private static final Instant CURSOR_CREATED_AT = Instant.ofEpochMilli(1_700_000_000_123L);
    private static final Instant CURSOR_UPDATED_AT = CURSOR_CREATED_AT.plusSeconds(60);
    private static final long CURSOR_DURATION = 3600L;
    private static final String DATE_VALUE = CURSOR_DAY + "_" + CURSOR_CREATED_AT.toEpochMilli();
    private static final String OLDER_DATE_CURSOR = DATE_VALUE + "_" + CURSOR_HEX;
    private static final int FETCH_LIMIT = 11;

    @Mock private TenantAwareMongoTemplate mongoTemplate;
    @Captor private ArgumentCaptor<Query> queryCaptor;
    @Captor private ArgumentCaptor<Aggregation> aggregationCaptor;
    @InjectMocks private CustomTimeEntryRepositoryImpl repository;

    @ParameterizedTest
    @MethodSource("valueSortsInEachFetchDirection")
    void findTimeEntriesWithCursor_valueSortWithoutPosition_sortsByFieldThenIdInFetchDirection(
            String sortField, String direction, boolean backward, int order) {
        // setup
        CursorPosition noPosition = new CursorPosition.None();
        Query filter = new Query();

        // execution
        repository.findTimeEntriesWithCursor(filter, noPosition, backward, FETCH_LIMIT, sortField, direction);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(TimeEntry.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(sortField, order).append(ID, order));
        assertThat(query.getLimit()).isEqualTo(FETCH_LIMIT);
        assertThat(query.getQueryObject()).isEmpty();
    }

    @ParameterizedTest
    @MethodSource("fetchDirections")
    void findTimeEntriesWithCursor_idSortWithoutPosition_sortsByIdInFetchDirection(
            String direction, boolean backward, String operator, int order) {
        // setup
        CursorPosition noPosition = new CursorPosition.None();
        Query filter = new Query();

        // execution
        repository.findTimeEntriesWithCursor(filter, noPosition, backward, FETCH_LIMIT, ID, direction);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(TimeEntry.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(ID, order));
        assertThat(query.getQueryObject()).isEmpty();
    }

    @ParameterizedTest
    @MethodSource("valueKeysetsInEachFetchDirection")
    void findTimeEntriesWithCursor_keysetWithValue_continuesPastTheValueInFetchDirection(
            KeysetCursor cursor, boolean backward, Document expectedKeyset, int order) {
        // setup
        String sortField = cursor.sortField();
        String direction = cursor.direction().name();
        Query filter = new Query();

        // execution
        repository.findTimeEntriesWithCursor(filter, cursor, backward, FETCH_LIMIT, sortField, direction);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(TimeEntry.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject().getList(AND, Document.class)).containsExactly(expectedKeyset);
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(sortField, order).append(ID, order));
        assertThat(query.getLimit()).isEqualTo(FETCH_LIMIT);
        verify(mongoTemplate, never()).findOne(any(Query.class), eq(TimeEntry.class));
    }

    @ParameterizedTest
    @MethodSource("nullKeysetsFetchedAscending")
    void findTimeEntriesWithCursor_nullValueKeysetFetchedAscending_restOfTheNullGroupThenEveryValue(
            KeysetCursor cursor, boolean backward) {
        // setup
        String sortField = cursor.sortField();
        String direction = cursor.direction().name();
        Query filter = new Query();
        Document restOfNullGroup = new Document(sortField, null).append(ID, new Document(GREATER, CURSOR_ID));
        Document everyValue = new Document(sortField, new Document("$ne", null));
        Document expectedKeyset = new Document(OR, List.of(restOfNullGroup, everyValue));

        // execution
        repository.findTimeEntriesWithCursor(filter, cursor, backward, FETCH_LIMIT, sortField, direction);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(TimeEntry.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject().getList(AND, Document.class)).containsExactly(expectedKeyset);
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(sortField, 1).append(ID, 1));
    }

    @ParameterizedTest
    @MethodSource("nullKeysetsFetchedDescending")
    void findTimeEntriesWithCursor_nullValueKeysetFetchedDescending_onlyTheRestOfTheNullGroup(
            KeysetCursor cursor, boolean backward) {
        // setup
        String sortField = cursor.sortField();
        String direction = cursor.direction().name();
        Query filter = new Query();
        Document restOfNullGroup = new Document(sortField, null).append(ID, new Document(LESS, CURSOR_ID));

        // execution
        repository.findTimeEntriesWithCursor(filter, cursor, backward, FETCH_LIMIT, sortField, direction);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(TimeEntry.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject().getList(AND, Document.class)).containsExactly(restOfNullGroup);
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(sortField, -1).append(ID, -1));
    }

    @ParameterizedTest
    @MethodSource("fetchDirections")
    void findTimeEntriesWithCursor_idSortKeyset_continuesPastTheIdInFetchDirection(
            String direction, boolean backward, String operator, int order) {
        // setup
        KeysetCursor cursor = new KeysetCursor(ID, Sort.Direction.valueOf(direction), "", CURSOR_HEX);
        Document pastId = new Document(ID, new Document(operator, CURSOR_ID));
        Query filter = new Query();

        // execution
        repository.findTimeEntriesWithCursor(filter, cursor, backward, FETCH_LIMIT, ID, direction);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(TimeEntry.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject().getList(AND, Document.class)).containsExactly(pastId);
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(ID, order));
    }

    @ParameterizedTest
    @MethodSource("fetchDirections")
    void findTimeEntriesWithCursor_rowIdUnderIdSort_completePositionWithoutReadingTheRow(
            String direction, boolean backward, String operator, int order) {
        // setup
        CursorPosition rowId = new CursorPosition.RowId(CURSOR_HEX);
        Document pastId = new Document(ID, new Document(operator, CURSOR_ID));
        Query filter = new Query();

        // execution
        repository.findTimeEntriesWithCursor(filter, rowId, backward, FETCH_LIMIT, ID, direction);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(TimeEntry.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject().getList(AND, Document.class)).containsExactly(pastId);
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(ID, order));
        verify(mongoTemplate, never()).findOne(any(Query.class), eq(TimeEntry.class));
        verify(mongoTemplate, never()).findById(any(Object.class), eq(TimeEntry.class));
    }

    @ParameterizedTest
    @MethodSource("rowValuesPerValueSort")
    void findTimeEntriesWithCursor_rowIdUnderAValueSort_readsTheRowOnceWithAQueryAndUsesItsCurrentValue(
            String sortField, Object currentValue) {
        // setup
        CursorPosition rowId = new CursorPosition.RowId(CURSOR_HEX);
        TimeEntry row = entry();
        Query filter = new Query();
        Document expectedKeyset = keysetPastValue(sortField, currentValue, GREATER, false);
        when(mongoTemplate.findOne(any(Query.class), eq(TimeEntry.class))).thenReturn(row);

        // execution
        repository.findTimeEntriesWithCursor(filter, rowId, false, FETCH_LIMIT, sortField, ASC);

        // verifications
        verify(mongoTemplate).findOne(queryCaptor.capture(), eq(TimeEntry.class));
        assertThat(queryCaptor.getValue().getQueryObject()).containsExactlyEntriesOf(new Document(ID, CURSOR_ID));
        verify(mongoTemplate).find(queryCaptor.capture(), eq(TimeEntry.class));
        assertThat(queryCaptor.getValue().getQueryObject().getList(AND, Document.class)).containsExactly(expectedKeyset);
        verify(mongoTemplate, never()).findById(any(Object.class), eq(TimeEntry.class));
    }

    @Test
    void findTimeEntriesWithCursor_rowIdBackwardUnderAValueSort_flipsTheComparisonOnTheRowsValue() {
        // setup
        CursorPosition rowId = new CursorPosition.RowId(CURSOR_HEX);
        TimeEntry row = entry();
        Query filter = new Query();
        Document expectedKeyset = keysetPastValue(STARTED_AT, CURSOR_STARTED_AT, LESS, true);
        when(mongoTemplate.findOne(any(Query.class), eq(TimeEntry.class))).thenReturn(row);

        // execution
        repository.findTimeEntriesWithCursor(filter, rowId, true, FETCH_LIMIT, STARTED_AT, ASC);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(TimeEntry.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject().getList(AND, Document.class)).containsExactly(expectedKeyset);
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(STARTED_AT, -1).append(ID, -1));
    }

    @Test
    void findTimeEntriesWithCursor_rowIdOfARunningEntryUnderEndedAt_continuesInsideTheNullGroup() {
        // setup
        CursorPosition rowId = new CursorPosition.RowId(CURSOR_HEX);
        TimeEntry running = TimeEntry.builder().id(CURSOR_HEX).startedAt(CURSOR_STARTED_AT).build();
        Query filter = new Query();
        Document restOfNullGroup = new Document(ENDED_AT, null).append(ID, new Document(LESS, CURSOR_ID));
        when(mongoTemplate.findOne(any(Query.class), eq(TimeEntry.class))).thenReturn(running);

        // execution
        repository.findTimeEntriesWithCursor(filter, rowId, false, FETCH_LIMIT, ENDED_AT, DESC);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(TimeEntry.class));
        assertThat(queryCaptor.getValue().getQueryObject().getList(AND, Document.class))
                .containsExactly(restOfNullGroup);
    }

    @ParameterizedTest
    @ValueSource(strings = {STARTED_AT, ENDED_AT, CREATED_AT, UPDATED_AT, DURATION_SECONDS, DATE})
    void findTimeEntriesWithCursor_rowIdOfAMissingRowUnderASortOtherThanId_throwsInvalidCursor(String sortField) {
        // setup
        CursorPosition rowId = new CursorPosition.RowId(CURSOR_HEX);
        Query filter = new Query();
        when(mongoTemplate.findOne(any(Query.class), eq(TimeEntry.class))).thenReturn(null);

        // execution
        Throwable thrown = catchThrowable(
                () -> repository.findTimeEntriesWithCursor(filter, rowId, false, FETCH_LIMIT, sortField, ASC));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verify(mongoTemplate, never()).find(any(Query.class), eq(TimeEntry.class));
        verify(mongoTemplate, never()).aggregate(any(Aggregation.class), eq(TimeEntry.class), eq(TimeEntry.class));
        verify(mongoTemplate, never()).findById(any(Object.class), eq(TimeEntry.class));
    }

    @ParameterizedTest
    @CsvSource({
            "startedAt, DESC",
            "endedAt, ASC",
            "createdAt, ASC",
            "durationSeconds, ASC",
            "_id, ASC",
            "date, ASC"
    })
    void findTimeEntriesWithCursor_keysetIssuedUnderAnotherSortFieldOrDirection_throwsInvalidCursor(
            String sortField, String direction) {
        // setup
        KeysetCursor startedAtAscending =
                KeysetCursor.ofInstant(STARTED_AT, Sort.Direction.ASC, CURSOR_STARTED_AT, CURSOR_HEX);
        Query filter = new Query();

        // execution
        Throwable thrown = catchThrowable(() -> repository.findTimeEntriesWithCursor(
                filter, startedAtAscending, false, FETCH_LIMIT, sortField, direction));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verify(mongoTemplate, never()).find(any(Query.class), eq(TimeEntry.class));
        verify(mongoTemplate, never()).aggregate(any(Aggregation.class), eq(TimeEntry.class), eq(TimeEntry.class));
    }

    @ParameterizedTest
    @MethodSource("unreadablePositions")
    void findTimeEntriesWithCursor_positionThatIsNotATimeEntryPosition_throwsInvalidCursor(
            CursorPosition position, String sortField) {
        // setup
        Query filter = new Query();

        // execution
        Throwable thrown = catchThrowable(
                () -> repository.findTimeEntriesWithCursor(filter, position, false, FETCH_LIMIT, sortField, DESC));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verify(mongoTemplate, never()).find(any(Query.class), eq(TimeEntry.class));
        verify(mongoTemplate, never()).findOne(any(Query.class), eq(TimeEntry.class));
        verify(mongoTemplate, never()).aggregate(any(Aggregation.class), eq(TimeEntry.class), eq(TimeEntry.class));
    }

    @Test
    void findTimeEntriesWithCursor_filterWithASearchAndAKeyset_keepsBothNextToEachOther() {
        // setup
        TimeEntryQueryFilter searched = TimeEntryQueryFilter.builder()
                .userIds(List.of("user-1"))
                .search("printer")
                .build();
        Query filter = repository.buildTimeEntryQuery(searched);
        KeysetCursor cursor = KeysetCursor.ofInstant(STARTED_AT, Sort.Direction.ASC, CURSOR_STARTED_AT, CURSOR_HEX);
        Document expectedKeyset = keysetPastValue(STARTED_AT, CURSOR_STARTED_AT, GREATER, false);

        // execution
        repository.findTimeEntriesWithCursor(filter, cursor, false, FETCH_LIMIT, STARTED_AT, ASC);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(TimeEntry.class));
        Document query = queryCaptor.getValue().getQueryObject();
        assertThat(query).containsKeys(USER_ID_FIELD, OR);
        assertThat(query.getList(AND, Document.class)).containsExactly(expectedKeyset);
    }

    @ParameterizedTest
    @MethodSource("fetchDirections")
    void findTimeEntriesWithCursor_dateSortWithoutPosition_tenantMatchThenDayCreatedAtIdSortInFetchDirection(
            String direction, boolean backward, String operator, int order) {
        // setup
        stubDatePipeline();
        CursorPosition noPosition = new CursorPosition.None();
        Query filter = new Query();
        Document tenantMatch = new Document(MATCH, new Document(TENANT_FIELD, TENANT_ID));
        Document daySort = new Document(SORT, new Document(WORK_DAY, order).append(CREATED_AT, order).append(ID, order));
        Document limit = new Document(LIMIT, (long) FETCH_LIMIT);

        // execution
        repository.findTimeEntriesWithCursor(filter, noPosition, backward, FETCH_LIMIT, DATE, direction);

        // verifications
        verify(mongoTemplate).aggregate(aggregationCaptor.capture(), eq(TimeEntry.class), eq(TimeEntry.class));
        List<Document> stages = aggregationCaptor.getValue().toPipeline(Aggregation.DEFAULT_CONTEXT);
        assertThat(stages).extracting(CustomTimeEntryRepositoryImplCursorTest::operatorOf)
                .containsExactly(MATCH, ADD_FIELDS, SORT, LIMIT);
        assertThat(stages).startsWith(tenantMatch).endsWith(daySort, limit);
        verify(mongoTemplate, never()).find(any(Query.class), eq(TimeEntry.class));
    }

    @Test
    void findTimeEntriesWithCursor_dateSortWithAFilter_filterMatchFollowsTheTenantMatch() {
        // setup
        stubDatePipeline();
        CursorPosition noPosition = new CursorPosition.None();
        Query filter = new Query(Criteria.where(USER_ID_FIELD).is("user-1"));
        Document tenantMatch = new Document(MATCH, new Document(TENANT_FIELD, TENANT_ID));
        Document filterMatch = new Document(MATCH, new Document(USER_ID_FIELD, "user-1"));

        // execution
        repository.findTimeEntriesWithCursor(filter, noPosition, true, FETCH_LIMIT, DATE, DESC);

        // verifications
        verify(mongoTemplate).aggregate(aggregationCaptor.capture(), eq(TimeEntry.class), eq(TimeEntry.class));
        List<Document> stages = aggregationCaptor.getValue().toPipeline(Aggregation.DEFAULT_CONTEXT);
        assertThat(stages).extracting(CustomTimeEntryRepositoryImplCursorTest::operatorOf)
                .containsExactly(MATCH, MATCH, ADD_FIELDS, SORT, LIMIT);
        assertThat(stages).startsWith(tenantMatch, filterMatch);
    }

    @ParameterizedTest
    @MethodSource("fetchDirections")
    void findTimeEntriesWithCursor_dateKeyset_continuesPastTheDayThenCreatedAtThenIdInFetchDirection(
            String direction, boolean backward, String operator, int order) {
        // setup
        stubDatePipeline();
        KeysetCursor cursor = new KeysetCursor(DATE, Sort.Direction.valueOf(direction), DATE_VALUE, CURSOR_HEX);
        Query filter = new Query();
        Document tenantMatch = new Document(MATCH, new Document(TENANT_FIELD, TENANT_ID));
        Document pastTheCursor = dateKeysetStage(operator);
        Document daySort = new Document(SORT, new Document(WORK_DAY, order).append(CREATED_AT, order).append(ID, order));

        // execution
        repository.findTimeEntriesWithCursor(filter, cursor, backward, FETCH_LIMIT, DATE, direction);

        // verifications
        verify(mongoTemplate).aggregate(aggregationCaptor.capture(), eq(TimeEntry.class), eq(TimeEntry.class));
        List<Document> stages = aggregationCaptor.getValue().toPipeline(Aggregation.DEFAULT_CONTEXT);
        assertThat(stages).extracting(CustomTimeEntryRepositoryImplCursorTest::operatorOf)
                .containsExactly(MATCH, ADD_FIELDS, MATCH, SORT, LIMIT);
        assertThat(stages).startsWith(tenantMatch).containsSequence(pastTheCursor, daySort);
        verify(mongoTemplate, never()).findOne(any(Query.class), eq(TimeEntry.class));
    }

    @ParameterizedTest
    @MethodSource("fetchDirections")
    void findTimeEntriesWithCursor_olderDayCreatedAtIdTextUnderTheDateSort_readAsTheSamePosition(
            String direction, boolean backward, String operator, int order) {
        // setup
        stubDatePipeline();
        CursorPosition olderCursor = new CursorPosition.Unrecognised(OLDER_DATE_CURSOR);
        Query filter = new Query();
        Document pastTheCursor = dateKeysetStage(operator);
        Document daySort = new Document(SORT, new Document(WORK_DAY, order).append(CREATED_AT, order).append(ID, order));

        // execution
        repository.findTimeEntriesWithCursor(filter, olderCursor, backward, FETCH_LIMIT, DATE, direction);

        // verifications
        verify(mongoTemplate).aggregate(aggregationCaptor.capture(), eq(TimeEntry.class), eq(TimeEntry.class));
        List<Document> stages = aggregationCaptor.getValue().toPipeline(Aggregation.DEFAULT_CONTEXT);
        assertThat(stages).containsSequence(pastTheCursor, daySort);
        verify(mongoTemplate, never()).findOne(any(Query.class), eq(TimeEntry.class));
    }

    @Test
    void findTimeEntriesWithCursor_rowIdUnderTheDateSort_readsTheRowOnceWithAQueryAndUsesItsDayAndCreatedAt() {
        // setup
        stubDatePipeline();
        CursorPosition rowId = new CursorPosition.RowId(CURSOR_HEX);
        TimeEntry row = entry();
        Query filter = new Query();
        Document pastTheCursor = dateKeysetStage(LESS);
        when(mongoTemplate.findOne(any(Query.class), eq(TimeEntry.class))).thenReturn(row);

        // execution
        repository.findTimeEntriesWithCursor(filter, rowId, false, FETCH_LIMIT, DATE, DESC);

        // verifications
        verify(mongoTemplate).findOne(queryCaptor.capture(), eq(TimeEntry.class));
        assertThat(queryCaptor.getValue().getQueryObject()).containsExactlyEntriesOf(new Document(ID, CURSOR_ID));
        verify(mongoTemplate).aggregate(aggregationCaptor.capture(), eq(TimeEntry.class), eq(TimeEntry.class));
        List<Document> stages = aggregationCaptor.getValue().toPipeline(Aggregation.DEFAULT_CONTEXT);
        assertThat(stages).contains(pastTheCursor);
        verify(mongoTemplate, never()).findById(any(Object.class), eq(TimeEntry.class));
    }

    @ParameterizedTest
    @MethodSource("entriesPerSort")
    void keysetCursor_eachSort_carriesTheSortFieldDirectionValueAndId(
            String sortField, String direction, TimeEntry entry, String expectedPayload) {
        // setup
        String entryId = entry.getId();

        // execution
        KeysetCursor cursor = repository.keysetCursor(entry, sortField, direction);

        // verifications
        assertThat(CursorBase64.decode(cursor.encode())).isEqualTo(expectedPayload);
        assertThat(cursor.id()).isEqualTo(entryId);
    }

    private static Stream<Arguments> valueSortsInEachFetchDirection() {
        return Stream.of(STARTED_AT, ENDED_AT, CREATED_AT, UPDATED_AT, DURATION_SECONDS).flatMap(sortField -> Stream.of(
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
        return Stream.of(STARTED_AT, ENDED_AT, CREATED_AT, UPDATED_AT, DURATION_SECONDS).flatMap(sortField -> Stream.of(
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
        return Stream.of(STARTED_AT, ENDED_AT, CREATED_AT, UPDATED_AT).flatMap(sortField -> Stream.of(
                arguments(nullKeyset(sortField, Sort.Direction.ASC), false),
                arguments(nullKeyset(sortField, Sort.Direction.DESC), true)));
    }

    private static Stream<Arguments> nullKeysetsFetchedDescending() {
        return Stream.of(STARTED_AT, ENDED_AT, CREATED_AT, UPDATED_AT).flatMap(sortField -> Stream.of(
                arguments(nullKeyset(sortField, Sort.Direction.DESC), false),
                arguments(nullKeyset(sortField, Sort.Direction.ASC), true)));
    }

    private static Stream<Arguments> rowValuesPerValueSort() {
        return Stream.of(STARTED_AT, ENDED_AT, CREATED_AT, UPDATED_AT, DURATION_SECONDS)
                .map(sortField -> arguments(sortField, valueOf(sortField)));
    }

    private static Stream<Arguments> unreadablePositions() {
        String createdAtMillis = Long.toString(CURSOR_CREATED_AT.toEpochMilli());
        return Stream.of(
                arguments(new CursorPosition.Unrecognised("not-a-cursor"), ID),
                arguments(new CursorPosition.Unrecognised("not-a-cursor"), STARTED_AT),
                arguments(new CursorPosition.Unrecognised(OLDER_DATE_CURSOR), STARTED_AT),
                arguments(new CursorPosition.Unrecognised(OLDER_DATE_CURSOR), ID),
                arguments(new CursorPosition.RowId("not-an-object-id"), ID),
                arguments(new CursorPosition.RowId("not-an-object-id"), ENDED_AT),
                arguments(new CursorPosition.RowId("not-an-object-id"), DATE),
                arguments(new KeysetCursor(ID, Sort.Direction.DESC, "", "not-an-object-id"), ID),
                arguments(new KeysetCursor(STARTED_AT, Sort.Direction.DESC, "yesterday", CURSOR_HEX), STARTED_AT),
                arguments(new KeysetCursor(ENDED_AT, Sort.Direction.DESC, "yesterday", CURSOR_HEX), ENDED_AT),
                arguments(new KeysetCursor(DURATION_SECONDS, Sort.Direction.DESC, "an-hour", CURSOR_HEX),
                        DURATION_SECONDS),
                arguments(new CursorPosition.Unrecognised("not-a-cursor"), DATE),
                arguments(new CursorPosition.Unrecognised(CURSOR_DAY + "_" + createdAtMillis), DATE),
                arguments(new CursorPosition.Unrecognised(CURSOR_DAY + "_noon_" + CURSOR_HEX), DATE),
                arguments(new CursorPosition.Unrecognised("someday_" + createdAtMillis + "_" + CURSOR_HEX), DATE),
                arguments(new CursorPosition.Unrecognised(CURSOR_DAY + "_17|00_" + CURSOR_HEX), DATE),
                arguments(new CursorPosition.Unrecognised(DATE_VALUE + "_not-an-object-id"), DATE),
                arguments(new CursorPosition.Unrecognised(DATE_VALUE + "_"), DATE),
                arguments(new KeysetCursor(DATE, Sort.Direction.DESC, DATE_VALUE, "not-an-object-id"), DATE),
                arguments(new KeysetCursor(DATE, Sort.Direction.DESC, CURSOR_DAY, CURSOR_HEX), DATE),
                arguments(new KeysetCursor(DATE, Sort.Direction.DESC, CURSOR_DAY + "_noon", CURSOR_HEX), DATE),
                arguments(new KeysetCursor(DATE, Sort.Direction.DESC, "someday_" + createdAtMillis, CURSOR_HEX), DATE),
                arguments(new KeysetCursor(DATE, Sort.Direction.DESC, "", CURSOR_HEX), DATE));
    }

    private static Stream<Arguments> entriesPerSort() {
        TimeEntry entry = entry();
        TimeEntry blank = TimeEntry.builder().id(CURSOR_HEX).build();
        String idSuffix = "|" + CURSOR_HEX;
        return Stream.of(
                arguments(DATE, DESC, entry, "k1|date|DESC|" + DATE_VALUE + idSuffix),
                arguments(DATE, ASC, entry, "k1|date|ASC|" + DATE_VALUE + idSuffix),
                arguments(STARTED_AT, DESC, entry, "k1|startedAt|DESC|" + CURSOR_STARTED_AT.toEpochMilli() + idSuffix),
                arguments(ENDED_AT, ASC, entry, "k1|endedAt|ASC|" + CURSOR_ENDED_AT.toEpochMilli() + idSuffix),
                arguments(CREATED_AT, DESC, entry, "k1|createdAt|DESC|" + CURSOR_CREATED_AT.toEpochMilli() + idSuffix),
                arguments(UPDATED_AT, ASC, entry, "k1|updatedAt|ASC|" + CURSOR_UPDATED_AT.toEpochMilli() + idSuffix),
                arguments(DURATION_SECONDS, DESC, entry, "k1|durationSeconds|DESC|" + CURSOR_DURATION + idSuffix),
                arguments(ID, DESC, entry, "k1|_id|DESC|" + idSuffix),
                arguments(ENDED_AT, DESC, blank, "k1|endedAt|DESC|" + idSuffix),
                arguments(STARTED_AT, ASC, blank, "k1|startedAt|ASC|" + idSuffix),
                arguments(DATE, DESC, blank, "k1|date|DESC|0000-00-00_0" + idSuffix));
    }

    private static TimeEntry entry() {
        return TimeEntry.builder()
                .id(CURSOR_HEX)
                .startedAt(CURSOR_STARTED_AT)
                .endedAt(CURSOR_ENDED_AT)
                .createdAt(CURSOR_CREATED_AT)
                .updatedAt(CURSOR_UPDATED_AT)
                .durationSeconds(CURSOR_DURATION)
                .build();
    }

    private static Object valueOf(String sortField) {
        return switch (sortField) {
            case STARTED_AT -> CURSOR_STARTED_AT;
            case ENDED_AT -> CURSOR_ENDED_AT;
            case CREATED_AT -> CURSOR_CREATED_AT;
            case UPDATED_AT -> CURSOR_UPDATED_AT;
            default -> CURSOR_DURATION;
        };
    }

    private static KeysetCursor valueKeyset(String sortField, Sort.Direction direction) {
        return DURATION_SECONDS.equals(sortField)
                ? new KeysetCursor(sortField, direction, Long.toString(CURSOR_DURATION), CURSOR_HEX)
                : KeysetCursor.ofInstant(sortField, direction, (Instant) valueOf(sortField), CURSOR_HEX);
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

    private static Document dateKeysetStage(String operator) {
        Document sameDay = new Document(WORK_DAY, CURSOR_DAY);
        Document sameCreatedAt = new Document(CREATED_AT, CURSOR_CREATED_AT);
        Document pastDay = new Document(WORK_DAY, new Document(operator, CURSOR_DAY));
        Document pastCreatedAt = new Document(CREATED_AT, new Document(operator, CURSOR_CREATED_AT));
        Document pastId = new Document(ID, new Document(operator, CURSOR_ID));
        Document sameDayPastCreatedAt = new Document(AND, List.of(sameDay, pastCreatedAt));
        Document sameDayAndCreatedAtPastId = new Document(AND, List.of(sameDay, sameCreatedAt, pastId));
        Document keyset = new Document(OR, List.of(pastDay, sameDayPastCreatedAt, sameDayAndCreatedAtPastId));
        return new Document(MATCH, keyset);
    }

    private static String operatorOf(Document stage) {
        return stage.keySet().iterator().next();
    }

    private void stubDatePipeline() {
        Criteria tenant = Criteria.where(TENANT_FIELD).is(TENANT_ID);
        AggregationResults<TimeEntry> noRows = new AggregationResults<>(List.of(), new Document());
        when(mongoTemplate.tenantCriteria()).thenReturn(tenant);
        when(mongoTemplate.aggregate(any(Aggregation.class), eq(TimeEntry.class), eq(TimeEntry.class)))
                .thenReturn(noRows);
    }
}
