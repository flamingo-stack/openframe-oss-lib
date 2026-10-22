package com.openframe.data.repository.knowledgebase;

import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemType;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

/**
 * The shape of the listing queries: each stream is sorted and limited by Mongo and continues from
 * a keyset position, and the parent filter tells the root level from the whole knowledge base.
 */
class KnowledgeBaseItemKeysetQueryTest {

    private static final String ID = "65f000000000000000000001";

    private final MongoTemplate template = mock(MongoTemplate.class);
    private final CustomKnowledgeBaseItemRepositoryImpl repo = new CustomKnowledgeBaseItemRepositoryImpl(template);

    @Test
    @DisplayName("folders: sorted by name asc / _id desc, limited, continued after the cursor")
    void foldersArePagedByNameThenId() {
        KnowledgeBaseItemCursor cursor =
                new KnowledgeBaseItemCursor(KnowledgeBaseItemType.FOLDER, ID, "Networking", null);

        repo.findFolders(KnowledgeBaseParentFilter.root(), null, null, cursor, 21);

        Query query = capturedFind();
        assertThat(query.getLimit()).isEqualTo(21);
        assertThat(query.getSortObject()).isEqualTo(new Document("name", 1).append("_id", -1));

        // name > N, or name = N and _id < id
        List<?> position = (List<?>) query.getQueryObject().get("$or");
        assertThat(position).hasSize(2);
        assertThat(((Document) position.get(0)).get("name")).isEqualTo(new Document("$gt", "Networking"));
        List<?> tie = (List<?>) ((Document) position.get(1)).get("$and");
        assertThat(((Document) tie.get(0)).get("name")).isEqualTo("Networking");
        assertThat(((Document) tie.get(1)).get("_id")).isEqualTo(new Document("$lt", new ObjectId(ID)));
    }

    @Test
    @DisplayName("folders: the name is compared case-insensitively and with digits by value")
    void foldersAreOrderedUnderTheNameCollation() {
        repo.findFolders(KnowledgeBaseParentFilter.root(), null, null, null, 21);

        // Sort and keyset comparison both follow the query's collation.
        assertThat(capturedFind().getCollation())
                .contains(CustomKnowledgeBaseItemRepositoryImpl.FOLDER_NAME_COLLATION);
        assertThat(CustomKnowledgeBaseItemRepositoryImpl.FOLDER_NAME_COLLATION.toDocument())
                .containsEntry("locale", "en")
                .containsEntry("strength", 2)
                .containsEntry("numericOrdering", true);
    }

    @Test
    @DisplayName("articles: sorted by updatedAt desc / _id desc, limited, continued after the cursor")
    void articlesArePagedByUpdatedAtThenId() {
        Instant updatedAt = Instant.ofEpochMilli(1_760_000_000_000L);
        KnowledgeBaseItemCursor cursor = new KnowledgeBaseItemCursor(KnowledgeBaseItemType.ARTICLE, ID, null, updatedAt);

        repo.findArticles(KnowledgeBaseParentFilter.root(), null, null, null, cursor, 21);

        Query query = capturedFind();
        assertThat(query.getLimit()).isEqualTo(21);
        assertThat(query.getSortObject()).isEqualTo(new Document("updatedAt", -1).append("_id", -1));

        // updatedAt < U, or updatedAt = U and _id < id
        List<?> position = (List<?>) query.getQueryObject().get("$or");
        assertThat(position).hasSize(2);
        assertThat(((Document) position.get(0)).get("updatedAt")).isEqualTo(new Document("$lt", updatedAt));
        List<?> tie = (List<?>) ((Document) position.get(1)).get("$and");
        assertThat(((Document) tie.get(0)).get("updatedAt")).isEqualTo(updatedAt);
        assertThat(((Document) tie.get(1)).get("_id")).isEqualTo(new Document("$lt", new ObjectId(ID)));
        // Articles are ordered by a date: no collation, so the plain indexes stay usable.
        assertThat(query.getCollation()).isEmpty();
    }

    @Test
    @DisplayName("a search and a cursor on the same article query are merged under one $and")
    void articleSearchAndCursorShareOneAnd() {
        KnowledgeBaseItemCursor cursor = new KnowledgeBaseItemCursor(
                KnowledgeBaseItemType.ARTICLE, ID, null, Instant.ofEpochMilli(1_760_000_000_000L));

        repo.findArticles(KnowledgeBaseParentFilter.any(), "vpn", null, null, cursor, 21);

        Document filter = capturedFind().getQueryObject();
        assertThat(filter).containsKey("$and");
        assertThat(filter).doesNotContainKey("$or");
    }

    @Test
    @DisplayName("the root level filters on a null parent; the whole knowledge base does not filter on parent at all")
    void rootLevelAndWholeKnowledgeBaseDiffer() {
        assertThat(folderFilter(KnowledgeBaseParentFilter.root())).containsKey("parentId");
        assertThat(folderFilter(KnowledgeBaseParentFilter.of(List.of("p1", "p2")))).containsKey("parentId");
        assertThat(folderFilter(KnowledgeBaseParentFilter.any())).doesNotContainKey("parentId");
    }

    private static Document folderFilter(KnowledgeBaseParentFilter parent) {
        MongoTemplate folderTemplate = mock(MongoTemplate.class);
        new CustomKnowledgeBaseItemRepositoryImpl(folderTemplate).findFolders(parent, null, null, null, 5);

        ArgumentCaptor<Query> captor = ArgumentCaptor.forClass(Query.class);
        verify(folderTemplate).find(captor.capture(), eq(KnowledgeBaseItem.class));
        return captor.getValue().getQueryObject();
    }

    @Test
    @DisplayName("a tag filter, a search and a cursor can sit on one query without a criteria key collision")
    void filtersAndCursorDoNotCollide() {
        KnowledgeBaseItemCursor folderCursor =
                new KnowledgeBaseItemCursor(KnowledgeBaseItemType.FOLDER, ID, "Networking", null);
        KnowledgeBaseItemCursor idOnlyArticleCursor =
                new KnowledgeBaseItemCursor(KnowledgeBaseItemType.ARTICLE, ID, null, null);

        assertThatCode(() -> repo.findFolders(
                KnowledgeBaseParentFilter.of(List.of("p1", "p2")), "net", List.of(ID), folderCursor, 5))
                .doesNotThrowAnyException();
        assertThatCode(() -> repo.findArticles(
                KnowledgeBaseParentFilter.of(List.of("p1")), "net", List.of(ID), null, idOnlyArticleCursor, 5))
                .doesNotThrowAnyException();
    }

    private Query capturedFind() {
        ArgumentCaptor<Query> captor = ArgumentCaptor.forClass(Query.class);
        verify(template).find(captor.capture(), eq(KnowledgeBaseItem.class));
        return captor.getValue();
    }
}
