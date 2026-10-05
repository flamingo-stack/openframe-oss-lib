package com.openframe.api.service.knowledgebase;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.knowledgebase.KnowledgeBaseCursors;
import com.openframe.api.dto.knowledgebase.KnowledgeBaseFilterCriteria;
import com.openframe.api.dto.knowledgebase.KnowledgeBaseScope;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.service.AssignmentService;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemType;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemCursor;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemRepository;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseParentFilter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Cursor pagination of the item listing — folders first, then articles, each paged by the
 * repository — and which parents a listing reads from for each scope. The repository is mocked
 * with in-memory lists that honour the cursor and the limit the way the Mongo queries do.
 */
class KnowledgeBaseServicePaginationTest {

    private KnowledgeBaseItemRepository repository;
    private KnowledgeBaseTagService tagService;
    private KnowledgeBaseService service;

    @BeforeEach
    void setUp() {
        repository = mock(KnowledgeBaseItemRepository.class);
        tagService = mock(KnowledgeBaseTagService.class);
        // "No tag filter" is null, not the empty list a bare mock would answer with.
        when(tagService.findItemIdsByTags(any())).thenReturn(null);
        service = new KnowledgeBaseService(repository, tagService, mock(AssignmentService.class));
    }

    // ------------------------------------------------------------ paging

    @ParameterizedTest(name = "limit={0}")
    @ValueSource(ints = {1, 2, 3, 5, 7, 8, 9, 20})
    @DisplayName("walking every page returns each folder and article exactly once, folders first")
    void walkingAllPagesReturnsEveryItemOnce(int limit) {
        stubRepository(items("f", 7, KnowledgeBaseItemType.FOLDER), items("a", 3, KnowledgeBaseItemType.ARTICLE));

        List<String> seen = new ArrayList<>();
        String cursor = null;
        for (int pages = 0; pages < 20; pages++) {
            CountedGenericQueryResult<KnowledgeBaseItem> page = query(cursor, limit);
            page.getItems().forEach(item -> seen.add(item.getId()));
            assertThat(page.getItems()).hasSizeLessThanOrEqualTo(limit);
            assertThat(page.getFilteredCount()).isEqualTo(10);
            if (!page.getPageInfo().isHasNextPage()) {
                break;
            }
            assertThat(page.getItems()).isNotEmpty();
            cursor = CursorCodec.decode(page.getPageInfo().getEndCursor());
        }

        assertThat(seen).containsExactly("f0", "f1", "f2", "f3", "f4", "f5", "f6", "a0", "a1", "a2");
    }

    @Test
    @DisplayName("folders are fetched one page plus the look-ahead row at a time, never all at once")
    void foldersAreLimitedInTheDatabase() {
        stubRepository(items("f", 7, KnowledgeBaseItemType.FOLDER), items("a", 3, KnowledgeBaseItemType.ARTICLE));

        query(null, 3);

        verify(repository).findFolders(any(), any(), any(), isNull(), eq(4));
    }

    @Test
    @DisplayName("a FOLDER listing honours first/after instead of returning every folder")
    void foldersOnlyListingIsPaged() {
        stubRepository(items("f", 7, KnowledgeBaseItemType.FOLDER), items("a", 3, KnowledgeBaseItemType.ARTICLE));
        KnowledgeBaseFilterCriteria filter = KnowledgeBaseFilterCriteria.builder()
                .type(KnowledgeBaseItemType.FOLDER)
                .build();

        List<String> seen = new ArrayList<>();
        String cursor = null;
        int pages = 0;
        boolean hasNextPage = true;
        while (hasNextPage && pages < 10) {
            CountedGenericQueryResult<KnowledgeBaseItem> page = query(filter, null, cursor, 3);
            page.getItems().forEach(item -> seen.add(item.getId()));
            assertThat(page.getItems()).hasSizeLessThanOrEqualTo(3);
            assertThat(page.getFilteredCount()).isEqualTo(7);
            hasNextPage = page.getPageInfo().isHasNextPage();
            cursor = CursorCodec.decode(page.getPageInfo().getEndCursor());
            pages++;
        }

        assertThat(seen).containsExactly("f0", "f1", "f2", "f3", "f4", "f5", "f6");
        assertThat(pages).isEqualTo(3);
        verify(repository, never()).findArticles(any(), any(), any(), any(), any(), anyInt());
        verify(repository, never()).countArticles(any(), any(), any(), any());
    }

    @Test
    @DisplayName("a page filled exactly by folders reports a next page when articles follow")
    void pageFilledByFoldersHasNextPageWhenArticlesExist() {
        stubRepository(items("f", 3, KnowledgeBaseItemType.FOLDER), items("a", 2, KnowledgeBaseItemType.ARTICLE));

        CountedGenericQueryResult<KnowledgeBaseItem> page = query(null, 3);

        assertThat(page.getItems()).extracting(KnowledgeBaseItem::getId).containsExactly("f0", "f1", "f2");
        assertThat(page.getPageInfo().isHasNextPage()).isTrue();
    }

    @Test
    @DisplayName("a page filled exactly by folders has no next page when there are no articles")
    void pageFilledByFoldersHasNoNextPageWithoutArticles() {
        stubRepository(items("f", 3, KnowledgeBaseItemType.FOLDER), List.of());

        CountedGenericQueryResult<KnowledgeBaseItem> page = query(null, 3);

        assertThat(page.getItems()).hasSize(3);
        assertThat(page.getPageInfo().isHasNextPage()).isFalse();
    }

    // ------------------------------------------------------------ cursors issued before the stream tag

    @Test
    @DisplayName("a bare article id still skips the folders and continues the articles")
    void legacyArticleCursorContinuesArticles() {
        List<KnowledgeBaseItem> articles = items("a", 3, KnowledgeBaseItemType.ARTICLE);
        stubRepository(items("f", 2, KnowledgeBaseItemType.FOLDER), articles);
        when(repository.findById("a0")).thenReturn(Optional.of(articles.get(0)));

        CountedGenericQueryResult<KnowledgeBaseItem> page = query("a0", 20);

        assertThat(page.getItems()).extracting(KnowledgeBaseItem::getId).containsExactly("a1", "a2");
        assertThat(page.getPageInfo().isHasNextPage()).isFalse();
        assertThat(page.getPageInfo().isHasPreviousPage()).isTrue();
    }

    @Test
    @DisplayName("a bare folder id continues the folders and runs on into the articles")
    void legacyFolderCursorContinuesFolders() {
        List<KnowledgeBaseItem> folders = items("f", 3, KnowledgeBaseItemType.FOLDER);
        stubRepository(folders, items("a", 2, KnowledgeBaseItemType.ARTICLE));
        when(repository.findById("f0")).thenReturn(Optional.of(folders.get(0)));

        CountedGenericQueryResult<KnowledgeBaseItem> page = query("f0", 20);

        assertThat(page.getItems()).extracting(KnowledgeBaseItem::getId).containsExactly("f1", "f2", "a0", "a1");
    }

    @Test
    @DisplayName("a bare id whose document is gone is positioned as an article cursor, as it was before")
    void legacyCursorOfMissingItemIsAnArticleCursor() {
        stubRepository(items("f", 2, KnowledgeBaseItemType.FOLDER), items("a", 3, KnowledgeBaseItemType.ARTICLE));

        CountedGenericQueryResult<KnowledgeBaseItem> page = query("a0", 20);

        assertThat(page.getItems()).extracting(KnowledgeBaseItem::getId).containsExactly("a1", "a2");
    }

    @Test
    @DisplayName("archived articles continue from the position the cursor carries")
    void archivedArticlesContinueFromTheCursorPosition() {
        Instant updatedAt = Instant.ofEpochMilli(1_760_000_000_000L);
        KnowledgeBaseItem last = KnowledgeBaseItem.builder()
                .id("a9")
                .type(KnowledgeBaseItemType.ARTICLE)
                .name("a9")
                .updatedAt(updatedAt)
                .build();
        String cursor = CursorCodec.decode(KnowledgeBaseCursors.encode(last));

        service.queryArchivedArticles(null, null, CursorPaginationCriteria.builder().cursor(cursor).limit(20).build());

        verify(repository).findArchivedArticles(
                isNull(), isNull(),
                eq(new KnowledgeBaseItemCursor(KnowledgeBaseItemType.ARTICLE, "a9", null, updatedAt)),
                eq(21));
    }

    // ------------------------------------------------------------ scope

    @Test
    @DisplayName("DESCENDANTS without a parent reads the whole knowledge base")
    void descendantsOfTheRootIsUnrestricted() {
        stubRepository(items("f", 2, KnowledgeBaseItemType.FOLDER), items("a", 2, KnowledgeBaseItemType.ARTICLE));

        query(scoped(null, KnowledgeBaseScope.DESCENDANTS), null, null, 20);

        assertThat(folderParent()).isEqualTo(KnowledgeBaseParentFilter.any());
        assertThat(articleParent()).isEqualTo(KnowledgeBaseParentFilter.any());
    }

    @Test
    @DisplayName("DESCENDANTS of a folder reads that folder and every folder below it")
    void descendantsOfAFolderCoversItsSubtree() {
        stubRepository(List.of(), List.of());
        when(repository.findFolderLinks()).thenReturn(List.of(
                folder("p", null), folder("c1", "p"), folder("c2", "p"), folder("g1", "c1"),
                folder("other", null), folder("o1", "other")));

        query(scoped("p", KnowledgeBaseScope.DESCENDANTS), null, null, 20);

        KnowledgeBaseParentFilter parent = articleParent();
        assertThat(parent.unrestricted()).isFalse();
        assertThat(parent.parentIds()).containsExactlyInAnyOrder("p", "c1", "c2", "g1");
        assertThat(folderParent()).isEqualTo(parent);
    }

    @Test
    @DisplayName("DESCENDANTS under a search returns folders as well as articles")
    void descendantsWithSearchIncludesFolders() {
        stubRepository(items("f", 1, KnowledgeBaseItemType.FOLDER), items("a", 1, KnowledgeBaseItemType.ARTICLE));

        CountedGenericQueryResult<KnowledgeBaseItem> page =
                query(scoped(null, KnowledgeBaseScope.DESCENDANTS), "vpn", null, 20);

        assertThat(page.getItems()).extracting(KnowledgeBaseItem::getId).containsExactly("f0", "a0");
        assertThat(page.getFilteredCount()).isEqualTo(2);
    }

    @Test
    @DisplayName("CHILDREN stays on one level even under a search")
    void childrenWithSearchStaysOnTheLevel() {
        stubRepository(items("f", 1, KnowledgeBaseItemType.FOLDER), items("a", 1, KnowledgeBaseItemType.ARTICLE));

        query(scoped(null, KnowledgeBaseScope.CHILDREN), "vpn", null, 20);

        assertThat(folderParent()).isEqualTo(KnowledgeBaseParentFilter.root());
        assertThat(articleParent()).isEqualTo(KnowledgeBaseParentFilter.root());
        verify(repository, never()).findFolderLinks();
    }

    // ------------------------------------------------------------ no scope: the rules that predate it

    @Test
    @DisplayName("no scope, plain listing: one level")
    void withoutScopeAPlainListingIsOneLevel() {
        stubRepository(items("f", 1, KnowledgeBaseItemType.FOLDER), items("a", 1, KnowledgeBaseItemType.ARTICLE));

        query(KnowledgeBaseFilterCriteria.builder().parentId("p").build(), null, null, 20);

        assertThat(folderParent()).isEqualTo(KnowledgeBaseParentFilter.of(List.of("p")));
        assertThat(articleParent()).isEqualTo(KnowledgeBaseParentFilter.of(List.of("p")));
        verify(repository, never()).findFolderLinks();
    }

    @Test
    @DisplayName("no scope, search: the matching articles of the whole subtree and no folders")
    void withoutScopeASearchReturnsSubtreeArticlesOnly() {
        stubRepository(items("f", 2, KnowledgeBaseItemType.FOLDER), items("a", 2, KnowledgeBaseItemType.ARTICLE));

        CountedGenericQueryResult<KnowledgeBaseItem> page =
                query(KnowledgeBaseFilterCriteria.builder().build(), "vpn", null, 20);

        assertThat(page.getItems()).extracting(KnowledgeBaseItem::getId).containsExactly("a0", "a1");
        assertThat(page.getFilteredCount()).isEqualTo(2);
        assertThat(articleParent()).isEqualTo(KnowledgeBaseParentFilter.any());
        verify(repository, never()).findFolders(any(), any(), any(), any(), anyInt());
        verify(repository, never()).countFolders(any(), any(), any());
    }

    @Test
    @DisplayName("no scope, tags inside a folder: the tagged articles of that folder's subtree and no folders")
    void withoutScopeATagFilterInsideAFolderReturnsSubtreeArticlesOnly() {
        stubRepository(items("f", 2, KnowledgeBaseItemType.FOLDER), items("a", 2, KnowledgeBaseItemType.ARTICLE));
        when(tagService.findItemIdsByTags(List.of("t1"))).thenReturn(List.of("a0"));
        when(repository.findFolderLinks()).thenReturn(List.of(folder("p", null), folder("c1", "p")));

        query(KnowledgeBaseFilterCriteria.builder().parentId("p").tagIds(List.of("t1")).build(), null, null, 20);

        assertThat(articleParent().parentIds()).containsExactlyInAnyOrder("p", "c1");
        verify(repository, never()).findFolders(any(), any(), any(), any(), anyInt());
    }

    @Test
    @DisplayName("no scope, tags at the root: root folders, and the tagged articles of every level")
    void withoutScopeATagFilterAtTheRootReadsArticlesFromEveryLevel() {
        stubRepository(List.of(), items("a", 1, KnowledgeBaseItemType.ARTICLE));
        when(tagService.findItemIdsByTags(List.of("t1"))).thenReturn(List.of("a0"));

        query(KnowledgeBaseFilterCriteria.builder().tagIds(List.of("t1")).build(), null, null, 20);

        assertThat(folderParent()).isEqualTo(KnowledgeBaseParentFilter.root());
        assertThat(articleParent()).isEqualTo(KnowledgeBaseParentFilter.any());
    }

    // ------------------------------------------------------------ helpers

    private CountedGenericQueryResult<KnowledgeBaseItem> query(String cursor, int limit) {
        return query(KnowledgeBaseFilterCriteria.builder().build(), null, cursor, limit);
    }

    private CountedGenericQueryResult<KnowledgeBaseItem> query(
            KnowledgeBaseFilterCriteria filter, String search, String cursor, int limit) {
        return service.queryItems(
                filter,
                search,
                CursorPaginationCriteria.builder().cursor(cursor).limit(limit).build());
    }

    private static KnowledgeBaseFilterCriteria scoped(String parentId, KnowledgeBaseScope scope) {
        return KnowledgeBaseFilterCriteria.builder().parentId(parentId).scope(scope).build();
    }

    private KnowledgeBaseParentFilter folderParent() {
        ArgumentCaptor<KnowledgeBaseParentFilter> captor = ArgumentCaptor.forClass(KnowledgeBaseParentFilter.class);
        verify(repository).findFolders(captor.capture(), any(), any(), any(), anyInt());
        return captor.getValue();
    }

    private KnowledgeBaseParentFilter articleParent() {
        ArgumentCaptor<KnowledgeBaseParentFilter> captor = ArgumentCaptor.forClass(KnowledgeBaseParentFilter.class);
        verify(repository).findArticles(captor.capture(), any(), any(), any(), any(), anyInt());
        return captor.getValue();
    }

    private void stubRepository(List<KnowledgeBaseItem> folders, List<KnowledgeBaseItem> articles) {
        when(repository.countFolders(any(), any(), any())).thenReturn((long) folders.size());
        when(repository.findFolders(any(), any(), any(), any(), anyInt())).thenAnswer(invocation -> {
            KnowledgeBaseItemCursor cursor = invocation.getArgument(3);
            int limit = invocation.getArgument(4);
            return pageAfter(folders, cursor, limit);
        });
        when(repository.countArticles(any(), any(), any(), any())).thenReturn((long) articles.size());
        when(repository.findArticles(any(), any(), any(), any(), any(), anyInt())).thenAnswer(invocation -> {
            KnowledgeBaseItemCursor cursor = invocation.getArgument(4);
            int limit = invocation.getArgument(5);
            return pageAfter(articles, cursor, limit);
        });
    }

    private static List<KnowledgeBaseItem> pageAfter(List<KnowledgeBaseItem> items, KnowledgeBaseItemCursor cursor,
                                                     int limit) {
        int start = 0;
        if (cursor != null) {
            start = IntStream.range(0, items.size())
                    .filter(i -> items.get(i).getId().equals(cursor.id()))
                    .findFirst()
                    .orElse(items.size() - 1) + 1;
        }
        return items.subList(start, Math.min(items.size(), start + limit));
    }

    private static List<KnowledgeBaseItem> items(String prefix, int count, KnowledgeBaseItemType type) {
        return IntStream.range(0, count)
                .mapToObj(i -> KnowledgeBaseItem.builder().id(prefix + i).type(type).name(prefix + i).build())
                .toList();
    }

    private static KnowledgeBaseItem folder(String id, String parentId) {
        return KnowledgeBaseItem.builder()
                .id(id)
                .type(KnowledgeBaseItemType.FOLDER)
                .name(id)
                .parentId(parentId)
                .build();
    }
}
