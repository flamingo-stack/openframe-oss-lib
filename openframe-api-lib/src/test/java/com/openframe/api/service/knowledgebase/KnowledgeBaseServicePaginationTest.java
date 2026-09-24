package com.openframe.api.service.knowledgebase;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.knowledgebase.KnowledgeBaseFilterCriteria;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.service.AssignmentService;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemType;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Cursor pagination of the mixed (folders first, then articles) item listing. Repository is mocked
 * with an in-memory article list that honours the article cursor the way the Mongo query does.
 */
class KnowledgeBaseServicePaginationTest {

    private KnowledgeBaseItemRepository repository;
    private KnowledgeBaseService service;

    @BeforeEach
    void setUp() {
        repository = mock(KnowledgeBaseItemRepository.class);
        service = new KnowledgeBaseService(repository, mock(KnowledgeBaseTagService.class), mock(AssignmentService.class));
    }

    @ParameterizedTest(name = "limit={0}")
    @ValueSource(ints = {1, 2, 3, 5, 7, 8, 9, 20})
    @DisplayName("walking every page returns each folder and article exactly once, folders first")
    void walkingAllPagesReturnsEveryItemOnce(int limit) {
        List<KnowledgeBaseItem> folders = items("f", 7, KnowledgeBaseItemType.FOLDER);
        List<KnowledgeBaseItem> articles = items("a", 3, KnowledgeBaseItemType.ARTICLE);
        stubRepository(folders, articles);

        List<String> seen = new ArrayList<>();
        String cursor = null;
        for (int pages = 0; pages < 20; pages++) {
            CountedGenericQueryResult<KnowledgeBaseItem> page = query(cursor, limit);
            page.getItems().forEach(item -> seen.add(item.getId()));
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

    @Test
    @DisplayName("an article cursor skips the folders and continues the articles")
    void articleCursorContinuesArticles() {
        stubRepository(items("f", 2, KnowledgeBaseItemType.FOLDER), items("a", 3, KnowledgeBaseItemType.ARTICLE));

        CountedGenericQueryResult<KnowledgeBaseItem> page = query("a0", 20);

        assertThat(page.getItems()).extracting(KnowledgeBaseItem::getId).containsExactly("a1", "a2");
        assertThat(page.getPageInfo().isHasNextPage()).isFalse();
        assertThat(page.getPageInfo().isHasPreviousPage()).isTrue();
    }

    private CountedGenericQueryResult<KnowledgeBaseItem> query(String cursor, int limit) {
        return service.queryItems(
                KnowledgeBaseFilterCriteria.builder().build(),
                null,
                CursorPaginationCriteria.builder().cursor(cursor).limit(limit).build());
    }

    private void stubRepository(List<KnowledgeBaseItem> folders, List<KnowledgeBaseItem> articles) {
        when(repository.findFoldersForParent(isNull(), isNull(), any())).thenReturn(folders);
        when(repository.countArticles(isNull(), isNull(), eq(KnowledgeBaseItemType.ARTICLE), any(), any()))
                .thenReturn((long) articles.size());
        when(repository.findArticles(isNull(), isNull(), eq(KnowledgeBaseItemType.ARTICLE), any(), any(), any(), anyInt()))
                .thenAnswer(invocation -> {
                    String cursor = invocation.getArgument(5);
                    int limit = invocation.getArgument(6);
                    int start = 0;
                    if (cursor != null) {
                        start = IntStream.range(0, articles.size())
                                .filter(i -> articles.get(i).getId().equals(cursor))
                                .findFirst()
                                .orElse(articles.size() - 1) + 1;
                    }
                    return articles.subList(start, Math.min(articles.size(), start + limit));
                });
    }

    private static List<KnowledgeBaseItem> items(String prefix, int count, KnowledgeBaseItemType type) {
        return IntStream.range(0, count)
                .mapToObj(i -> KnowledgeBaseItem.builder().id(prefix + i).type(type).name(prefix + i).build())
                .toList();
    }
}
