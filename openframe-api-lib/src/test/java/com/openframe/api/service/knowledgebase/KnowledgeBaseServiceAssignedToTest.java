package com.openframe.api.service.knowledgebase;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.assignment.AssignmentTarget;
import com.openframe.api.dto.knowledgebase.KnowledgeBaseFilterCriteria;
import com.openframe.api.dto.knowledgebase.KnowledgeBaseScope;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.service.AssignmentService;
import com.openframe.data.document.assignment.AssignmentItemType;
import com.openframe.data.document.assignment.AssignmentTargetType;
import com.openframe.data.document.knowledgebase.KnowledgeBaseArticleStatus;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemType;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemCursor;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemRepository;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseParentFilter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * The listing filtered by assignment target (the Assigned Articles tab on a customer or a
 * device): articles only, the whole knowledge base, restricted to the ids the assignments name,
 * composed with the search, the tag filter and the article cursor like any other listing. Also
 * the tags facet of that same set.
 */
class KnowledgeBaseServiceAssignedToTest {

    private static final AssignmentTarget ORGANIZATION =
            new AssignmentTarget(AssignmentTargetType.ORGANIZATION, "org-1");
    private static final AssignmentTarget DEVICE =
            new AssignmentTarget(AssignmentTargetType.DEVICE, "machine-1");

    private KnowledgeBaseItemRepository repository;
    private KnowledgeBaseTagService tagService;
    private AssignmentService assignmentService;
    private KnowledgeBaseService service;

    @BeforeEach
    void setUp() {
        repository = mock(KnowledgeBaseItemRepository.class);
        tagService = mock(KnowledgeBaseTagService.class);
        assignmentService = mock(AssignmentService.class);
        // "No tag filter" is null, not the empty list a bare mock would answer with.
        when(tagService.findItemIdsByTags(any())).thenReturn(null);
        service = new KnowledgeBaseService(repository, tagService, assignmentService,
                mock(KnowledgeBaseTempAttachmentService.class), mock(KnowledgeBaseAttachmentService.class));
    }

    // ------------------------------------------------------------ the assigned set

    @Test
    @DisplayName("assigned to an organization: the articles the assignments name, no folders, counted as articles")
    void assignedToOrganizationListsOnlyAssignedArticles() {
        givenAssigned(ORGANIZATION, "a0", "a1");
        stubArticles(items("a", 2));

        CountedGenericQueryResult<KnowledgeBaseItem> page = query(assignedTo(ORGANIZATION), null, null, 20);

        assertThat(page.getItems()).extracting(KnowledgeBaseItem::getId).containsExactly("a0", "a1");
        assertThat(page.getFilteredCount()).isEqualTo(2);
        verify(repository).findArticles(any(), isNull(), eq(List.of("a0", "a1")), isNull(), isNull(), eq(21));
        verify(repository).countArticles(any(), isNull(), eq(List.of("a0", "a1")), isNull());
        verify(repository, never()).findFolders(any(), any(), any(), any(), anyInt());
        verify(repository, never()).countFolders(any(), any(), any());
    }

    @Test
    @DisplayName("assigned to a device: the lookup is made for KNOWLEDGE_ARTICLE items of that device")
    void assignedToDeviceLooksUpArticlesOfThatMachine() {
        givenAssigned(DEVICE, "a0");
        stubArticles(items("a", 1));

        CountedGenericQueryResult<KnowledgeBaseItem> page = query(assignedTo(DEVICE), null, null, 20);

        assertThat(page.getItems()).extracting(KnowledgeBaseItem::getId).containsExactly("a0");
        verify(assignmentService).findAssignedItemIds(AssignmentItemType.KNOWLEDGE_ARTICLE, DEVICE);
    }

    @Test
    @DisplayName("the whole knowledge base is read: parentId and scope do not narrow an assigned listing")
    void parentAndScopeAreIgnored() {
        givenAssigned(ORGANIZATION, "a0");
        stubArticles(items("a", 1));
        KnowledgeBaseFilterCriteria filter = KnowledgeBaseFilterCriteria.builder()
                .parentId("p")
                .scope(KnowledgeBaseScope.CHILDREN)
                .assignedTo(ORGANIZATION)
                .build();

        query(filter, null, null, 20);

        assertThat(articleParent()).isEqualTo(KnowledgeBaseParentFilter.any());
        verify(repository, never()).findFolderLinks();
    }

    @Test
    @DisplayName("a FOLDER listing of an assigned set is empty: folders are never assigned")
    void folderTypeIsEmpty() {
        givenAssigned(ORGANIZATION, "a0");
        KnowledgeBaseFilterCriteria filter = KnowledgeBaseFilterCriteria.builder()
                .type(KnowledgeBaseItemType.FOLDER)
                .assignedTo(ORGANIZATION)
                .build();

        CountedGenericQueryResult<KnowledgeBaseItem> page = query(filter, null, null, 20);

        assertThat(page.getItems()).isEmpty();
        assertThat(page.getFilteredCount()).isZero();
        assertThat(page.getPageInfo().isHasNextPage()).isFalse();
        verifyNoInteractions(repository);
    }

    @Test
    @DisplayName("the search is passed down unchanged")
    void searchIsPassedThrough() {
        givenAssigned(ORGANIZATION, "a0");
        stubArticles(items("a", 1));

        query(assignedTo(ORGANIZATION), "vpn", null, 20);

        verify(repository).findArticles(any(), eq("vpn"), eq(List.of("a0")), isNull(), isNull(), eq(21));
        verify(repository).countArticles(any(), eq("vpn"), eq(List.of("a0")), isNull());
    }

    // ------------------------------------------------------------ with the tag filter

    @Test
    @DisplayName("a tag filter and an assigned set intersect")
    void tagFilterIntersectsWithTheAssignedSet() {
        givenAssigned(ORGANIZATION, "a0", "a1", "a2");
        when(tagService.findItemIdsByTags(List.of("t1"))).thenReturn(List.of("a1", "a2", "a9"));
        stubArticles(items("a", 3));
        KnowledgeBaseFilterCriteria filter = KnowledgeBaseFilterCriteria.builder()
                .tagIds(List.of("t1"))
                .assignedTo(ORGANIZATION)
                .build();

        query(filter, null, null, 20);

        verify(repository).findArticles(any(), isNull(), eq(List.of("a1", "a2")), isNull(), isNull(), eq(21));
        verify(repository).countArticles(any(), isNull(), eq(List.of("a1", "a2")), isNull());
    }

    @Test
    @DisplayName("an empty intersection restricts to nothing; it is not read as 'no restriction'")
    void emptyIntersectionIsEmptyNotUnrestricted() {
        givenAssigned(ORGANIZATION, "a0");
        when(tagService.findItemIdsByTags(List.of("t1"))).thenReturn(List.of("a5"));
        stubArticles(List.of());
        KnowledgeBaseFilterCriteria filter = KnowledgeBaseFilterCriteria.builder()
                .tagIds(List.of("t1"))
                .assignedTo(ORGANIZATION)
                .build();

        CountedGenericQueryResult<KnowledgeBaseItem> page = query(filter, null, null, 20);

        assertThat(page.getItems()).isEmpty();
        verify(repository).findArticles(any(), isNull(), eq(List.of()), isNull(), isNull(), eq(21));
        verify(repository).countArticles(any(), isNull(), eq(List.of()), isNull());
    }

    // ------------------------------------------------------------ nothing assigned

    @Test
    @DisplayName("a target with no assignments restricts to nothing and lists nothing")
    void noAssignmentsGivesAnEmptyPage() {
        givenAssigned(ORGANIZATION);
        stubArticles(List.of());

        CountedGenericQueryResult<KnowledgeBaseItem> page = query(assignedTo(ORGANIZATION), null, null, 20);

        assertThat(page.getItems()).isEmpty();
        assertThat(page.getFilteredCount()).isZero();
        assertThat(page.getPageInfo().isHasNextPage()).isFalse();
        verify(repository).findArticles(any(), isNull(), eq(List.of()), isNull(), isNull(), eq(21));
    }

    // ------------------------------------------------------------ paging

    @ParameterizedTest(name = "limit={0}")
    @ValueSource(ints = {1, 2, 3, 5, 20})
    @DisplayName("walking every page returns each assigned article exactly once")
    void walkingAllPagesReturnsEveryAssignedArticleOnce(int limit) {
        givenAssigned(ORGANIZATION, "a0", "a1", "a2", "a3", "a4");
        stubArticles(items("a", 5));

        List<String> seen = new ArrayList<>();
        String cursor = null;
        for (int pages = 0; pages < 20; pages++) {
            CountedGenericQueryResult<KnowledgeBaseItem> page = query(assignedTo(ORGANIZATION), null, cursor, limit);
            page.getItems().forEach(item -> seen.add(item.getId()));
            assertThat(page.getItems()).hasSizeLessThanOrEqualTo(limit);
            assertThat(page.getFilteredCount()).isEqualTo(5);
            if (!page.getPageInfo().isHasNextPage()) {
                break;
            }
            assertThat(page.getItems()).isNotEmpty();
            cursor = CursorCodec.decode(page.getPageInfo().getEndCursor());
        }

        assertThat(seen).containsExactly("a0", "a1", "a2", "a3", "a4");
    }

    // ------------------------------------------------------------ tags facet

    @Test
    @DisplayName("the tags of an assigned set are the tags of its non-archived articles")
    void tagsOfAssignedArticlesSkipArchivedOnes() {
        givenAssigned(ORGANIZATION, "a0", "a1", "a2");
        when(repository.findAllById(List.of("a0", "a1", "a2"))).thenReturn(List.of(
                article("a0", KnowledgeBaseArticleStatus.PUBLISHED),
                article("a1", KnowledgeBaseArticleStatus.ARCHIVED),
                article("a2", KnowledgeBaseArticleStatus.DRAFT)));
        List<Tag> tags = List.of(Tag.builder().id("t1").build());
        when(tagService.getTagsForItemIds(any())).thenReturn(tags);

        List<Tag> result = service.getTagsOfAssignedArticles(ORGANIZATION);

        assertThat(result).isSameAs(tags);
        ArgumentCaptor<List<String>> itemIds = ArgumentCaptor.captor();
        verify(tagService).getTagsForItemIds(itemIds.capture());
        assertThat(itemIds.getValue()).containsExactlyInAnyOrder("a0", "a2");
    }

    @Test
    @DisplayName("no assignments: no tags, and no tag lookup")
    void tagsOfNothingAssignedIsEmpty() {
        givenAssigned(ORGANIZATION);

        List<Tag> result = service.getTagsOfAssignedArticles(ORGANIZATION);

        assertThat(result).isEmpty();
        verify(tagService, never()).getTagsForItemIds(any());
        verifyNoInteractions(repository);
    }

    // ------------------------------------------------------------ helpers

    private void givenAssigned(AssignmentTarget target, String... articleIds) {
        when(assignmentService.findAssignedItemIds(AssignmentItemType.KNOWLEDGE_ARTICLE, target))
                .thenReturn(List.of(articleIds));
    }

    private static KnowledgeBaseFilterCriteria assignedTo(AssignmentTarget target) {
        return KnowledgeBaseFilterCriteria.builder().assignedTo(target).build();
    }

    private CountedGenericQueryResult<KnowledgeBaseItem> query(
            KnowledgeBaseFilterCriteria filter, String search, String cursor, int limit) {
        return service.queryItems(
                filter,
                search,
                CursorPaginationCriteria.builder().cursor(cursor).limit(limit).build());
    }

    private KnowledgeBaseParentFilter articleParent() {
        ArgumentCaptor<KnowledgeBaseParentFilter> captor = ArgumentCaptor.forClass(KnowledgeBaseParentFilter.class);
        verify(repository).findArticles(captor.capture(), any(), any(), any(), any(), anyInt());
        return captor.getValue();
    }

    /** The repository answers with the given articles, restricted to the ids it is asked for, cursor and limit honoured. */
    private void stubArticles(List<KnowledgeBaseItem> articles) {
        when(repository.countArticles(any(), any(), any(), any())).thenAnswer(invocation ->
                (long) restrict(articles, invocation.getArgument(2)).size());
        when(repository.findArticles(any(), any(), any(), any(), any(), anyInt())).thenAnswer(invocation -> {
            List<KnowledgeBaseItem> candidates = restrict(articles, invocation.getArgument(2));
            KnowledgeBaseItemCursor cursor = invocation.getArgument(4);
            int limit = invocation.getArgument(5);
            return pageAfter(candidates, cursor, limit);
        });
    }

    private static List<KnowledgeBaseItem> restrict(List<KnowledgeBaseItem> articles, List<String> itemIds) {
        if (itemIds == null) {
            return articles;
        }
        return articles.stream().filter(article -> itemIds.contains(article.getId())).toList();
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

    private static List<KnowledgeBaseItem> items(String prefix, int count) {
        return IntStream.range(0, count)
                .mapToObj(i -> article(prefix + i, KnowledgeBaseArticleStatus.PUBLISHED))
                .toList();
    }

    private static KnowledgeBaseItem article(String id, KnowledgeBaseArticleStatus status) {
        return KnowledgeBaseItem.builder()
                .id(id)
                .type(KnowledgeBaseItemType.ARTICLE)
                .name(id)
                .status(status)
                .build();
    }
}
