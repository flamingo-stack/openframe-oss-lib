package com.openframe.data.repository.knowledgebase;

import com.openframe.core.exception.InvalidCursorException;
import com.openframe.data.document.knowledgebase.KnowledgeBaseArticleStatus;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemType;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomKnowledgeBaseItemRepositoryImplCursorTest {

    private static final String NAME = "name";
    private static final String UPDATED_AT = "updatedAt";
    private static final String ID = "_id";
    private static final String TYPE = "type";
    private static final String STATUS = "status";
    private static final String AND = "$and";
    private static final String OR = "$or";
    private static final String GREATER = "$gt";
    private static final String LESS = "$lt";
    private static final String INVALID_CURSOR = "Invalid cursor";
    private static final String SEARCH = "net";
    private static final String CURSOR_ID = "65f1a2b3c4d5e6f708192a3b";
    private static final ObjectId CURSOR_OBJECT_ID = new ObjectId(CURSOR_ID);
    private static final String CURSOR_NAME = "Networking";
    private static final Instant CURSOR_UPDATED_AT = Instant.ofEpochMilli(1_760_000_000_123L);
    private static final KnowledgeBaseItemCursor FOLDER_CURSOR =
            new KnowledgeBaseItemCursor(KnowledgeBaseItemType.FOLDER, CURSOR_ID, CURSOR_NAME, null);
    private static final KnowledgeBaseItemCursor ARTICLE_CURSOR =
            new KnowledgeBaseItemCursor(KnowledgeBaseItemType.ARTICLE, CURSOR_ID, null, CURSOR_UPDATED_AT);
    private static final KnowledgeBaseItemCursor UNDATED_ARTICLE_CURSOR =
            new KnowledgeBaseItemCursor(KnowledgeBaseItemType.ARTICLE, CURSOR_ID, null, null);
    private static final KnowledgeBaseItemCursor CURSOR_WITHOUT_A_POSITION =
            new KnowledgeBaseItemCursor(KnowledgeBaseItemType.ARTICLE, "not-an-id", null, null);
    private static final KnowledgeBaseParentFilter ANY_PARENT = KnowledgeBaseParentFilter.any();
    private static final int FETCH_LIMIT = 21;

    @Mock private MongoTemplate mongoTemplate;
    @Captor private ArgumentCaptor<Query> queryCaptor;
    @InjectMocks private CustomKnowledgeBaseItemRepositoryImpl repository;

    @ParameterizedTest
    @MethodSource("folderFetchDirections")
    void findFolders_noCursor_sortsByNameThenIdInFetchDirectionUnderTheNameCollation(
            boolean backward, String nameOperator, String idOperator, int nameOrder, int idOrder) {
        // setup
        Document expectedSort = new Document(NAME, nameOrder).append(ID, idOrder);

        // execution
        repository.findFolders(ANY_PARENT, null, null, null, backward, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(KnowledgeBaseItem.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getSortObject()).containsExactlyEntriesOf(expectedSort);
        assertThat(query.getLimit()).isEqualTo(FETCH_LIMIT);
        assertThat(query.getCollation()).contains(CustomKnowledgeBaseItemRepositoryImpl.FOLDER_NAME_COLLATION);
        assertThat(query.getQueryObject())
                .containsEntry(TYPE, KnowledgeBaseItemType.FOLDER)
                .doesNotContainKeys(OR, AND);
    }

    @ParameterizedTest
    @MethodSource("folderFetchDirections")
    void findFolders_folderCursor_continuesPastTheNameThenTheIdInFetchDirection(
            boolean backward, String nameOperator, String idOperator, int nameOrder, int idOrder) {
        // setup
        List<Document> expectedPosition = folderPositionPast(nameOperator, idOperator);
        Document expectedSort = new Document(NAME, nameOrder).append(ID, idOrder);

        // execution
        repository.findFolders(ANY_PARENT, null, null, FOLDER_CURSOR, backward, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(KnowledgeBaseItem.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject().getList(OR, Document.class)).containsExactlyElementsOf(expectedPosition);
        assertThat(query.getSortObject()).containsExactlyEntriesOf(expectedSort);
        assertThat(query.getCollation()).contains(CustomKnowledgeBaseItemRepositoryImpl.FOLDER_NAME_COLLATION);
    }

    @Test
    void findFolders_backwardWithASearch_keepsTheSearchNextToThePosition() {
        // setup
        List<Document> expectedPosition = folderPositionPast(LESS, GREATER);

        // execution
        repository.findFolders(ANY_PARENT, SEARCH, null, FOLDER_CURSOR, true, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(KnowledgeBaseItem.class));
        Document filter = queryCaptor.getValue().getQueryObject();
        assertThat(filter).containsKey(NAME);
        assertThat(filter.getList(OR, Document.class)).containsExactlyElementsOf(expectedPosition);
    }

    @ParameterizedTest
    @MethodSource("articleFetchDirections")
    void findArticles_noCursor_sortsByUpdatedAtThenIdInFetchDirectionWithoutACollation(
            boolean backward, String operator, int order) {
        // setup
        Document expectedSort = new Document(UPDATED_AT, order).append(ID, order);

        // execution
        repository.findArticles(ANY_PARENT, null, null, null, null, backward, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(KnowledgeBaseItem.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getSortObject()).containsExactlyEntriesOf(expectedSort);
        assertThat(query.getLimit()).isEqualTo(FETCH_LIMIT);
        assertThat(query.getCollation()).isEmpty();
        assertThat(query.getQueryObject())
                .containsEntry(TYPE, KnowledgeBaseItemType.ARTICLE)
                .doesNotContainKeys(OR, AND);
    }

    @ParameterizedTest
    @MethodSource("articleFetchDirections")
    void findArticles_articleCursor_continuesPastUpdatedAtThenTheIdInFetchDirection(
            boolean backward, String operator, int order) {
        // setup
        List<Document> expectedPosition = articlePositionPast(operator);
        Document expectedSort = new Document(UPDATED_AT, order).append(ID, order);

        // execution
        repository.findArticles(ANY_PARENT, null, null, null, ARTICLE_CURSOR, backward, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(KnowledgeBaseItem.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject().getList(OR, Document.class)).containsExactlyElementsOf(expectedPosition);
        assertThat(query.getSortObject()).containsExactlyEntriesOf(expectedSort);
    }

    @ParameterizedTest
    @MethodSource("articleFetchDirections")
    void findArticles_articleCursorWithoutUpdatedAt_continuesPastTheIdInFetchDirection(
            boolean backward, String operator, int order) {
        // setup
        Document pastId = new Document(ID, new Document(operator, CURSOR_OBJECT_ID));

        // execution
        repository.findArticles(ANY_PARENT, null, null, null, UNDATED_ARTICLE_CURSOR, backward, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(KnowledgeBaseItem.class));
        assertThat(queryCaptor.getValue().getQueryObject().getList(AND, Document.class)).containsExactly(pastId);
    }

    @Test
    void findArticles_backwardWithASearch_mergesTheSearchAndThePositionUnderOneAnd() {
        // setup
        Document expectedPosition = new Document(OR, articlePositionPast(GREATER));

        // execution
        repository.findArticles(ANY_PARENT, SEARCH, null, null, ARTICLE_CURSOR, true, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(KnowledgeBaseItem.class));
        Document filter = queryCaptor.getValue().getQueryObject();
        assertThat(filter).doesNotContainKey(OR);
        assertThat(filter.getList(AND, Document.class))
                .hasSize(2)
                .contains(expectedPosition);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void findArticles_cursorWithNeitherUpdatedAtNorAStoredId_throwsInvalidCursor(boolean backward) {
        // setup
        KnowledgeBaseItemCursor cursor = CURSOR_WITHOUT_A_POSITION;

        // execution
        Throwable thrown = catchThrowable(
                () -> repository.findArticles(ANY_PARENT, null, null, null, cursor, backward, FETCH_LIMIT));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verify(mongoTemplate, never()).find(any(Query.class), eq(KnowledgeBaseItem.class));
    }

    @ParameterizedTest
    @MethodSource("articleFetchDirections")
    void findArchivedArticles_noCursor_sortsArchivedArticlesByUpdatedAtThenIdInFetchDirection(
            boolean backward, String operator, int order) {
        // setup
        Document expectedSort = new Document(UPDATED_AT, order).append(ID, order);

        // execution
        repository.findArchivedArticles(null, null, null, backward, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(KnowledgeBaseItem.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getSortObject()).containsExactlyEntriesOf(expectedSort);
        assertThat(query.getLimit()).isEqualTo(FETCH_LIMIT);
        assertThat(query.getCollation()).isEmpty();
        assertThat(query.getQueryObject())
                .containsEntry(TYPE, KnowledgeBaseItemType.ARTICLE)
                .containsEntry(STATUS, KnowledgeBaseArticleStatus.ARCHIVED)
                .doesNotContainKeys(OR, AND);
    }

    @ParameterizedTest
    @MethodSource("articleFetchDirections")
    void findArchivedArticles_articleCursor_continuesPastUpdatedAtThenTheIdInFetchDirection(
            boolean backward, String operator, int order) {
        // setup
        List<Document> expectedPosition = articlePositionPast(operator);
        Document expectedSort = new Document(UPDATED_AT, order).append(ID, order);

        // execution
        repository.findArchivedArticles(null, null, ARTICLE_CURSOR, backward, FETCH_LIMIT);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(KnowledgeBaseItem.class));
        Query query = queryCaptor.getValue();
        assertThat(query.getQueryObject())
                .containsEntry(STATUS, KnowledgeBaseArticleStatus.ARCHIVED);
        assertThat(query.getQueryObject().getList(OR, Document.class)).containsExactlyElementsOf(expectedPosition);
        assertThat(query.getSortObject()).containsExactlyEntriesOf(expectedSort);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void findArchivedArticles_cursorWithNeitherUpdatedAtNorAStoredId_throwsInvalidCursor(boolean backward) {
        // setup
        KnowledgeBaseItemCursor cursor = CURSOR_WITHOUT_A_POSITION;

        // execution
        Throwable thrown = catchThrowable(
                () -> repository.findArchivedArticles(null, null, cursor, backward, FETCH_LIMIT));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verify(mongoTemplate, never()).find(any(Query.class), eq(KnowledgeBaseItem.class));
    }

    @Test
    void findCursorItem_storedId_readsTheRowWithOneQueryOnTheId() {
        // setup
        KnowledgeBaseItem row = KnowledgeBaseItem.builder().id(CURSOR_ID).name(CURSOR_NAME).build();
        Document byId = new Document(ID, CURSOR_OBJECT_ID);
        when(mongoTemplate.findOne(any(Query.class), eq(KnowledgeBaseItem.class))).thenReturn(row);

        // execution
        Optional<KnowledgeBaseItem> found = repository.findCursorItem(CURSOR_ID);

        // verifications
        assertThat(found).containsSame(row);
        verify(mongoTemplate).findOne(queryCaptor.capture(), eq(KnowledgeBaseItem.class));
        assertThat(queryCaptor.getValue().getQueryObject()).containsExactlyEntriesOf(byId);
        verifyNoMoreInteractions(mongoTemplate);
    }

    @Test
    void findCursorItem_noRowWithTheId_returnsEmpty() {
        // setup
        when(mongoTemplate.findOne(any(Query.class), eq(KnowledgeBaseItem.class))).thenReturn(null);

        // execution
        Optional<KnowledgeBaseItem> found = repository.findCursorItem(CURSOR_ID);

        // verifications
        assertThat(found).isEmpty();
        verify(mongoTemplate).findOne(any(Query.class), eq(KnowledgeBaseItem.class));
    }

    @ParameterizedTest
    @ValueSource(strings = {"not-an-id", "65f1a2b3c4d5e6f708192a3", "X:65f1a2b3c4d5e6f708192a3b:1"})
    void findCursorItem_textThatIsNotAnId_returnsEmptyWithoutAQuery(String text) {
        // setup
        String cursorText = text;

        // execution
        Optional<KnowledgeBaseItem> found = repository.findCursorItem(cursorText);

        // verifications
        assertThat(found).isEmpty();
        verifyNoInteractions(mongoTemplate);
    }

    private static Stream<Arguments> folderFetchDirections() {
        return Stream.of(
                arguments(false, GREATER, LESS, 1, -1),
                arguments(true, LESS, GREATER, -1, 1));
    }

    private static Stream<Arguments> articleFetchDirections() {
        return Stream.of(
                arguments(false, LESS, -1),
                arguments(true, GREATER, 1));
    }

    private static List<Document> folderPositionPast(String nameOperator, String idOperator) {
        Document pastName = new Document(NAME, new Document(nameOperator, CURSOR_NAME));
        Document sameName = new Document(NAME, CURSOR_NAME);
        Document pastId = new Document(ID, new Document(idOperator, CURSOR_OBJECT_ID));
        Document sameNamePastId = new Document(AND, List.of(sameName, pastId));
        return List.of(pastName, sameNamePastId);
    }

    private static List<Document> articlePositionPast(String operator) {
        Document pastUpdatedAt = new Document(UPDATED_AT, new Document(operator, CURSOR_UPDATED_AT));
        Document sameUpdatedAt = new Document(UPDATED_AT, CURSOR_UPDATED_AT);
        Document pastId = new Document(ID, new Document(operator, CURSOR_OBJECT_ID));
        Document sameUpdatedAtPastId = new Document(AND, List.of(sameUpdatedAt, pastId));
        return List.of(pastUpdatedAt, sameUpdatedAtPastId);
    }
}
