package com.openframe.data.repository.rmm;

import com.openframe.core.exception.InvalidCursorException;
import com.openframe.data.document.rmm.filter.ScriptQueryFilter;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.document.tag.TagAssignment;
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
import org.springframework.data.mongodb.core.MongoTemplate;
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
class CustomScriptRepositoryImplCursorTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String TENANT_FIELD = "tenantId";
    private static final String ID = "_id";
    private static final String NAME = "name";
    private static final String CREATED_AT = "createdAt";
    private static final String UPDATED_AT = "updatedAt";
    private static final String AND = "$and";
    private static final String OR = "$or";
    private static final String GREATER = "$gt";
    private static final String LESS = "$lt";
    private static final String INVALID_CURSOR = "Invalid cursor";
    private static final String CURSOR_HEX = "65f1a2b3c4d5e6f708192a3b";
    private static final ObjectId CURSOR_ID = new ObjectId(CURSOR_HEX);
    private static final String TAGGED_HEX = "65f1a2b3c4d5e6f708192a01";
    private static final ObjectId TAGGED_ID = new ObjectId(TAGGED_HEX);
    private static final String CURSOR_NAME = "Restart Spooler";
    private static final Instant CURSOR_INSTANT = Instant.ofEpochMilli(1_700_000_000_123L);
    private static final int FETCH_LIMIT = 11;

    @Mock private MongoTemplate mongoTemplate;
    @Captor private ArgumentCaptor<Query> queryCaptor;
    @InjectMocks private CustomScriptRepositoryImpl repository;

    @ParameterizedTest
    @MethodSource("valueSortsInEachFetchDirection")
    void findPageForTenant_valueSortWithoutPosition_sortsByFieldThenIdInFetchDirection(
            String sortField, Sort.Direction direction, boolean backward, int order) {
        // setup
        CursorPosition noPosition = new CursorPosition.None();

        // execution
        repository.findPageForTenant(TENANT_ID, null, null, sortField, direction, noPosition, backward, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Script.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(sortField, order).append(ID, order));
        assertThat(query.getLimit()).isEqualTo(FETCH_LIMIT);
        assertThat(query.getQueryObject())
                .containsEntry(TENANT_FIELD, TENANT_ID)
                .doesNotContainKeys(AND, OR, ID);
    }

    @ParameterizedTest
    @MethodSource("fetchDirections")
    void findPageForTenant_idSortWithoutPosition_sortsByIdInFetchDirection(
            Sort.Direction direction, boolean backward, String operator, int order) {
        // setup
        CursorPosition noPosition = new CursorPosition.None();

        // execution
        repository.findPageForTenant(TENANT_ID, null, null, ID, direction, noPosition, backward, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Script.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(ID, order));
        assertThat(query.getQueryObject())
                .containsEntry(TENANT_FIELD, TENANT_ID)
                .doesNotContainKeys(AND, OR, ID);
    }

    @ParameterizedTest
    @MethodSource("valueKeysetsInEachFetchDirection")
    void findPageForTenant_keysetWithValue_continuesPastTheValueInFetchDirection(
            KeysetCursor cursor, boolean backward, Document expectedKeyset, int order) {
        // setup
        String sortField = cursor.sortField();
        Sort.Direction direction = cursor.direction();

        // execution
        repository.findPageForTenant(TENANT_ID, null, null, sortField, direction, cursor, backward, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Script.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject().getList(AND, Document.class))
                .hasSize(2)
                .contains(expectedKeyset)
                .anySatisfy(predicate -> assertThat(predicate).containsEntry(TENANT_FIELD, TENANT_ID));
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(sortField, order).append(ID, order));
        verify(mongoTemplate, never()).findOne(any(Query.class), eq(Script.class));
    }

    @ParameterizedTest
    @MethodSource("nullKeysetsFetchedAscending")
    void findPageForTenant_nullValueKeysetFetchedAscending_restOfTheNullGroupThenEveryValue(
            KeysetCursor cursor, boolean backward) {
        // setup
        String sortField = cursor.sortField();
        Document restOfNullGroup = new Document(sortField, null).append(ID, new Document(GREATER, CURSOR_ID));
        Document everyValue = new Document(sortField, new Document("$ne", null));
        Document expectedKeyset = new Document(OR, List.of(restOfNullGroup, everyValue));

        // execution
        repository.findPageForTenant(TENANT_ID, null, null, sortField, cursor.direction(), cursor, backward, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Script.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject().getList(AND, Document.class)).hasSize(2).contains(expectedKeyset);
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(sortField, 1).append(ID, 1));
    }

    @ParameterizedTest
    @MethodSource("nullKeysetsFetchedDescending")
    void findPageForTenant_nullValueKeysetFetchedDescending_onlyTheRestOfTheNullGroup(
            KeysetCursor cursor, boolean backward) {
        // setup
        String sortField = cursor.sortField();
        Document restOfNullGroup = new Document(sortField, null).append(ID, new Document(LESS, CURSOR_ID));

        // execution
        repository.findPageForTenant(TENANT_ID, null, null, sortField, cursor.direction(), cursor, backward, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Script.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject().getList(AND, Document.class)).hasSize(2).contains(restOfNullGroup);
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(sortField, -1).append(ID, -1));
    }

    @ParameterizedTest
    @MethodSource("fetchDirections")
    void findPageForTenant_idSortKeyset_continuesPastTheIdInFetchDirection(
            Sort.Direction direction, boolean backward, String operator, int order) {
        // setup
        KeysetCursor cursor = new KeysetCursor(ID, direction, "", CURSOR_HEX);
        Document pastId = new Document(ID, new Document(operator, CURSOR_ID));

        // execution
        repository.findPageForTenant(TENANT_ID, null, null, ID, direction, cursor, backward, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Script.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject().getList(AND, Document.class))
                .hasSize(2)
                .contains(pastId)
                .anySatisfy(predicate -> assertThat(predicate).containsEntry(TENANT_FIELD, TENANT_ID));
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(ID, order));
    }

    @ParameterizedTest
    @MethodSource("fetchDirections")
    void findPageForTenant_rowIdUnderIdSort_completePositionWithoutReadingTheRow(
            Sort.Direction direction, boolean backward, String operator, int order) {
        // setup
        CursorPosition rowId = new CursorPosition.RowId(CURSOR_HEX);
        Document pastId = new Document(ID, new Document(operator, CURSOR_ID));

        // execution
        repository.findPageForTenant(TENANT_ID, null, null, ID, direction, rowId, backward, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Script.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject().getList(AND, Document.class)).hasSize(2).contains(pastId);
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(ID, order));
        verify(mongoTemplate, never()).findOne(any(Query.class), eq(Script.class));
        verify(mongoTemplate, never()).findById(any(Object.class), eq(Script.class));
    }

    @ParameterizedTest
    @MethodSource("rowsPerValueSort")
    void findPageForTenant_rowIdUnderAValueSort_readsTheRowOnceInsideTheTenantAndUsesItsCurrentValue(
            String sortField, Script row, Object currentValue) {
        // setup
        CursorPosition rowId = new CursorPosition.RowId(CURSOR_HEX);
        Document expectedKeyset = keysetPastValue(sortField, currentValue, GREATER, false);
        when(mongoTemplate.findOne(any(Query.class), eq(Script.class))).thenReturn(row);

        // execution
        repository.findPageForTenant(TENANT_ID, null, null, sortField, Sort.Direction.ASC, rowId, false, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).findOne(queryCaptor.capture(), eq(Script.class));
        assertThat(queryCaptor.getValue().getQueryObject())
                .containsEntry(ID, CURSOR_ID)
                .containsEntry(TENANT_FIELD, TENANT_ID);
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Script.class));
        assertThat(queryCaptor.getValue().getQueryObject().getList(AND, Document.class))
                .hasSize(2)
                .contains(expectedKeyset);
        verify(mongoTemplate, never()).findById(any(Object.class), eq(Script.class));
    }

    @Test
    void findPageForTenant_rowIdBackwardUnderAValueSort_flipsTheComparisonOnTheRowsValue() {
        // setup
        CursorPosition rowId = new CursorPosition.RowId(CURSOR_HEX);
        Script row = Script.builder().id(CURSOR_HEX).name(CURSOR_NAME).build();
        Document expectedKeyset = keysetPastValue(NAME, CURSOR_NAME, LESS, true);
        when(mongoTemplate.findOne(any(Query.class), eq(Script.class))).thenReturn(row);

        // execution
        repository.findPageForTenant(TENANT_ID, null, null, NAME, Sort.Direction.ASC, rowId, true, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Script.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject().getList(AND, Document.class)).hasSize(2).contains(expectedKeyset);
        assertThat(query.getSortObject()).containsExactlyEntriesOf(new Document(NAME, -1).append(ID, -1));
    }

    @ParameterizedTest
    @ValueSource(strings = {NAME, CREATED_AT, UPDATED_AT})
    void findPageForTenant_rowIdOfARowWithoutAValue_continuesInsideTheNullGroup(String sortField) {
        // setup
        CursorPosition rowId = new CursorPosition.RowId(CURSOR_HEX);
        Script row = Script.builder().id(CURSOR_HEX).build();
        Document restOfNullGroup = new Document(sortField, null).append(ID, new Document(LESS, CURSOR_ID));
        when(mongoTemplate.findOne(any(Query.class), eq(Script.class))).thenReturn(row);

        // execution
        repository.findPageForTenant(TENANT_ID, null, null, sortField, Sort.Direction.DESC, rowId, false, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Script.class));
        assertThat(queryCaptor.getValue().getQueryObject().getList(AND, Document.class))
                .hasSize(2)
                .contains(restOfNullGroup);
    }

    @ParameterizedTest
    @ValueSource(strings = {NAME, CREATED_AT, UPDATED_AT})
    void findPageForTenant_rowIdOfAMissingRowUnderAValueSort_throwsInvalidCursor(String sortField) {
        // setup
        CursorPosition rowId = new CursorPosition.RowId(CURSOR_HEX);
        when(mongoTemplate.findOne(any(Query.class), eq(Script.class))).thenReturn(null);

        // execution
        Throwable thrown = catchThrowable(() -> repository.findPageForTenant(
                TENANT_ID, null, null, sortField, Sort.Direction.ASC, rowId, false, FETCH_LIMIT));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verify(mongoTemplate, never()).find(any(Query.class), eq(Script.class));
        verify(mongoTemplate, never()).findById(any(Object.class), eq(Script.class));
    }

    @ParameterizedTest
    @CsvSource({
            "name, DESC",
            "createdAt, ASC",
            "updatedAt, ASC",
            "_id, ASC"
    })
    void findPageForTenant_keysetIssuedUnderAnotherSortFieldOrDirection_throwsInvalidCursor(
            String sortField, Sort.Direction direction) {
        // setup
        KeysetCursor nameAscending = KeysetCursor.ofString(NAME, Sort.Direction.ASC, CURSOR_NAME, CURSOR_HEX);

        // execution
        Throwable thrown = catchThrowable(() -> repository.findPageForTenant(
                TENANT_ID, null, null, sortField, direction, nameAscending, false, FETCH_LIMIT));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verify(mongoTemplate, never()).find(any(Query.class), eq(Script.class));
    }

    @ParameterizedTest
    @MethodSource("unreadableScriptPositions")
    void findPageForTenant_positionThatIsNotAScriptPosition_throwsInvalidCursor(
            CursorPosition position, String sortField) {
        // setup
        Sort.Direction direction = Sort.Direction.ASC;

        // execution
        Throwable thrown = catchThrowable(() -> repository.findPageForTenant(
                TENANT_ID, null, null, sortField, direction, position, false, FETCH_LIMIT));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verify(mongoTemplate, never()).find(any(Query.class), eq(Script.class));
        verify(mongoTemplate, never()).findOne(any(Query.class), eq(Script.class));
    }

    @Test
    void findPageForTenant_tagFilterWithAnIdPosition_keepsTheTagRestrictionNextToTheKeyset() {
        // setup
        ScriptQueryFilter filter = ScriptQueryFilter.builder().tagIds(List.of("tag-1")).build();
        TagAssignment assignment = TagAssignment.builder().entityId(TAGGED_HEX).build();
        CursorPosition rowId = new CursorPosition.RowId(CURSOR_HEX);
        Document taggedScripts = new Document("$in", List.of(TAGGED_ID));
        Document pastId = new Document(ID, new Document(LESS, CURSOR_ID));
        when(mongoTemplate.find(any(Query.class), eq(TagAssignment.class))).thenReturn(List.of(assignment));

        // execution
        repository.findPageForTenant(TENANT_ID, filter, null, ID, Sort.Direction.DESC, rowId, false, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Script.class));
        assertThat(queryCaptor.getValue().getQueryObject().getList(AND, Document.class))
                .hasSize(2)
                .contains(pastId)
                .anySatisfy(predicate -> assertThat(predicate)
                        .containsEntry(TENANT_FIELD, TENANT_ID)
                        .containsEntry(ID, taggedScripts));
    }

    @Test
    void findPageForTenant_searchWithANamePosition_keepsTheSearchNextToTheKeyset() {
        // setup
        KeysetCursor cursor = KeysetCursor.ofString(NAME, Sort.Direction.ASC, CURSOR_NAME, CURSOR_HEX);
        Document expectedKeyset = keysetPastValue(NAME, CURSOR_NAME, GREATER, false);

        // execution
        repository.findPageForTenant(TENANT_ID, null, "spool", NAME, Sort.Direction.ASC, cursor, false, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Script.class));
        assertThat(queryCaptor.getValue().getQueryObject().getList(AND, Document.class))
                .hasSize(2)
                .contains(expectedKeyset)
                .anySatisfy(predicate -> assertThat(predicate)
                        .containsEntry(TENANT_FIELD, TENANT_ID)
                        .containsKey(NAME));
    }

    @ParameterizedTest
    @MethodSource("scriptsPerSort")
    void keysetCursor_eachSort_carriesTheSortFieldDirectionValueAndId(
            String sortField, Sort.Direction direction, Script script, String expectedPayload) {
        // setup
        String scriptId = script.getId();

        // execution
        KeysetCursor cursor = repository.keysetCursor(script, sortField, direction);

        // verifications
        assertThat(CursorBase64.decode(cursor.encode())).isEqualTo(expectedPayload);
        assertThat(cursor.id()).isEqualTo(scriptId);
    }

    private static Stream<Arguments> valueSortsInEachFetchDirection() {
        return Stream.of(NAME, CREATED_AT, UPDATED_AT).flatMap(sortField -> Stream.of(
                arguments(sortField, Sort.Direction.ASC, false, 1),
                arguments(sortField, Sort.Direction.ASC, true, -1),
                arguments(sortField, Sort.Direction.DESC, false, -1),
                arguments(sortField, Sort.Direction.DESC, true, 1)));
    }

    private static Stream<Arguments> fetchDirections() {
        return Stream.of(
                arguments(Sort.Direction.ASC, false, GREATER, 1),
                arguments(Sort.Direction.ASC, true, LESS, -1),
                arguments(Sort.Direction.DESC, false, LESS, -1),
                arguments(Sort.Direction.DESC, true, GREATER, 1));
    }

    private static Stream<Arguments> valueKeysetsInEachFetchDirection() {
        return Stream.of(NAME, CREATED_AT, UPDATED_AT).flatMap(sortField -> Stream.of(
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
        return Stream.of(NAME, CREATED_AT, UPDATED_AT).flatMap(sortField -> Stream.of(
                arguments(nullKeyset(sortField, Sort.Direction.ASC), false),
                arguments(nullKeyset(sortField, Sort.Direction.DESC), true)));
    }

    private static Stream<Arguments> nullKeysetsFetchedDescending() {
        return Stream.of(NAME, CREATED_AT, UPDATED_AT).flatMap(sortField -> Stream.of(
                arguments(nullKeyset(sortField, Sort.Direction.DESC), false),
                arguments(nullKeyset(sortField, Sort.Direction.ASC), true)));
    }

    private static Stream<Arguments> rowsPerValueSort() {
        Script row = script();
        return Stream.of(
                arguments(NAME, row, CURSOR_NAME),
                arguments(CREATED_AT, row, CURSOR_INSTANT),
                arguments(UPDATED_AT, row, CURSOR_INSTANT.plusSeconds(1)));
    }

    private static Stream<Arguments> unreadableScriptPositions() {
        String notBase64 = "%%%";
        return Stream.of(
                arguments(new CursorPosition.Unrecognised("not-a-cursor"), ID),
                arguments(new CursorPosition.Unrecognised("not-a-cursor"), NAME),
                arguments(new CursorPosition.Unrecognised(CURSOR_NAME + "|" + CURSOR_HEX), NAME),
                arguments(new KeysetCursor(ID, Sort.Direction.ASC, "", "not-an-object-id"), ID),
                arguments(KeysetCursor.ofString(NAME, Sort.Direction.ASC, CURSOR_NAME, "not-an-object-id"), NAME),
                arguments(new KeysetCursor(NAME, Sort.Direction.ASC, notBase64, CURSOR_HEX), NAME),
                arguments(new KeysetCursor(CREATED_AT, Sort.Direction.ASC, "yesterday", CURSOR_HEX), CREATED_AT),
                arguments(new KeysetCursor(UPDATED_AT, Sort.Direction.ASC, "yesterday", CURSOR_HEX), UPDATED_AT));
    }

    private static Stream<Arguments> scriptsPerSort() {
        Script script = script();
        Script blank = Script.builder().id(CURSOR_HEX).build();
        String idSuffix = "|" + CURSOR_HEX;
        long createdAtMillis = CURSOR_INSTANT.toEpochMilli();
        long updatedAtMillis = CURSOR_INSTANT.plusSeconds(1).toEpochMilli();
        return Stream.of(
                arguments(NAME, Sort.Direction.ASC, script, "k1|name|ASC|" + base64(CURSOR_NAME) + idSuffix),
                arguments(CREATED_AT, Sort.Direction.DESC, script, "k1|createdAt|DESC|" + createdAtMillis + idSuffix),
                arguments(UPDATED_AT, Sort.Direction.ASC, script, "k1|updatedAt|ASC|" + updatedAtMillis + idSuffix),
                arguments(ID, Sort.Direction.DESC, script, "k1|_id|DESC|" + idSuffix),
                arguments(ID, Sort.Direction.ASC, script, "k1|_id|ASC|" + idSuffix),
                arguments(NAME, Sort.Direction.DESC, blank, "k1|name|DESC|" + idSuffix),
                arguments(CREATED_AT, Sort.Direction.ASC, blank, "k1|createdAt|ASC|" + idSuffix),
                arguments(UPDATED_AT, Sort.Direction.DESC, blank, "k1|updatedAt|DESC|" + idSuffix));
    }

    private static Script script() {
        return Script.builder()
                .id(CURSOR_HEX)
                .name(CURSOR_NAME)
                .createdAt(CURSOR_INSTANT)
                .updatedAt(CURSOR_INSTANT.plusSeconds(1))
                .build();
    }

    private static Object valueOf(String sortField) {
        return NAME.equals(sortField) ? CURSOR_NAME : CURSOR_INSTANT;
    }

    private static KeysetCursor valueKeyset(String sortField, Sort.Direction direction) {
        return NAME.equals(sortField)
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
