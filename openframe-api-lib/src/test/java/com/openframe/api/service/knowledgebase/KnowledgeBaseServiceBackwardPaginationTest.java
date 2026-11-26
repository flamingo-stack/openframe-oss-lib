package com.openframe.api.service.knowledgebase;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.knowledgebase.KnowledgeBaseCursors;
import com.openframe.api.dto.knowledgebase.KnowledgeBaseFilterCriteria;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.core.exception.InvalidCursorException;
import com.openframe.data.document.knowledgebase.KnowledgeBaseArticleStatus;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemType;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemCursor;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemRepository;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseParentFilter;
import org.assertj.core.groups.Tuple;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.assertj.core.api.Assertions.tuple;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.atMostOnce;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KnowledgeBaseServiceBackwardPaginationTest {

    private static final String INVALID_CURSOR = "Invalid cursor";
    private static final String SEARCH = "vpn";
    private static final String GONE_ID = "65f1a2b3c4d5e6f708192c99";
    private static final String UNREADABLE_MILLIS_TAG = "A:65f1a2b3c4d5e6f708192c99:not-a-number";
    private static final String UNREADABLE_NAME_TAG = "F:65f1a2b3c4d5e6f708192c99:%zz";
    private static final int MAX_PAGES = 30;
    private static final Instant NEWEST = Instant.ofEpochMilli(1_760_000_300_000L);
    private static final Instant NEWER = Instant.ofEpochMilli(1_760_000_200_000L);
    private static final Instant OLDER = Instant.ofEpochMilli(1_760_000_100_000L);
    private static final Instant OLDEST = Instant.ofEpochMilli(1_760_000_000_000L);
    private static final KnowledgeBaseParentFilter ROOT = KnowledgeBaseParentFilter.root();
    private static final KnowledgeBaseFilterCriteria NO_FILTER = KnowledgeBaseFilterCriteria.builder().build();
    private static final KnowledgeBaseFilterCriteria FOLDERS_ONLY =
            KnowledgeBaseFilterCriteria.builder().type(KnowledgeBaseItemType.FOLDER).build();
    private static final KnowledgeBaseFilterCriteria ARTICLES_ONLY =
            KnowledgeBaseFilterCriteria.builder().type(KnowledgeBaseItemType.ARTICLE).build();
    private static final Comparator<KnowledgeBaseItemCursor> FOLDER_ORDER = Comparator
            .comparing(KnowledgeBaseItemCursor::name, String.CASE_INSENSITIVE_ORDER)
            .thenComparing(KnowledgeBaseItemCursor::id, Comparator.reverseOrder());
    private static final Comparator<KnowledgeBaseItemCursor> ARTICLE_ORDER = Comparator
            .comparing(KnowledgeBaseItemCursor::updatedAt, Comparator.<Instant>reverseOrder())
            .thenComparing(KnowledgeBaseItemCursor::id, Comparator.reverseOrder());
    private static final List<KnowledgeBaseItem> FOLDERS_IN_DISPLAY_ORDER = List.of(
            folder("65f1a2b3c4d5e6f708192a60", "Alpha"),
            folder("65f1a2b3c4d5e6f708192a10", "alpha"),
            folder("65f1a2b3c4d5e6f708192a30", "Bravo"),
            folder("65f1a2b3c4d5e6f708192a20", "charlie"),
            folder("65f1a2b3c4d5e6f708192a50", "Delta"),
            folder("65f1a2b3c4d5e6f708192a40", "echo"));
    private static final List<KnowledgeBaseItem> ARTICLES_IN_DISPLAY_ORDER = List.of(
            article("65f1a2b3c4d5e6f708192b50", "vpn", NEWEST),
            article("65f1a2b3c4d5e6f708192b40", "printer", NEWER),
            article("65f1a2b3c4d5e6f708192b20", "scanner", NEWER),
            article("65f1a2b3c4d5e6f708192b30", "backup", OLDER),
            article("65f1a2b3c4d5e6f708192b10", "wifi", OLDEST));

    @Mock private KnowledgeBaseItemRepository repository;
    @Mock private KnowledgeBaseTagService knowledgeBaseTagService;

    @InjectMocks private KnowledgeBaseService service;

    private List<KnowledgeBaseItem> folders = List.of();
    private List<KnowledgeBaseItem> articles = List.of();

    @ParameterizedTest(name = "{0} folders, {1} articles, pages of {2}")
    @MethodSource("knowledgeBasesOfMoreThanOnePage")
    void queryItems_beforeTheStartCursorOfEachForwardPage_returnsThePreviousForwardPage(
            int folderCount, int articleCount, int pageSize) {
        // setup
        stubKnowledgeBase(folderCount, articleCount);
        List<List<String>> expectedPages = pagesOf(displayedNames(), pageSize);

        // execution
        List<CountedGenericQueryResult<KnowledgeBaseItem>> forwardPages = walkForward(pageSize);
        List<CountedGenericQueryResult<KnowledgeBaseItem>> previousPages = pagesBeforeEachStart(forwardPages, pageSize);

        // verifications
        List<Tuple> forward = rowsAndCursorsOf(forwardPages);
        assertThat(forwardPages).extracting(KnowledgeBaseServiceBackwardPaginationTest::namesOf)
                .containsExactlyElementsOf(expectedPages);
        assertThat(rowsAndCursorsOf(previousPages))
                .hasSize(expectedPages.size() - 1)
                .containsExactlyElementsOf(forward.subList(0, forward.size() - 1));
    }

    @ParameterizedTest(name = "{0} folders, {1} articles, last {2}")
    @MethodSource("knowledgeBasesOfAnySize")
    void queryItems_lastWithoutBefore_returnsTheLastRowsInDisplayOrderWithoutANextPage(
            int folderCount, int articleCount, int pageSize) {
        // setup
        stubKnowledgeBase(folderCount, articleCount);
        List<String> lastRows = lastNames(displayedNames(), pageSize);
        boolean rowsBeforeThePage = folderCount + articleCount > pageSize;

        // execution
        CountedGenericQueryResult<KnowledgeBaseItem> result = service.queryItems(NO_FILTER, null, backward(pageSize, null));

        // verifications
        assertThat(result.getItems()).extracting(KnowledgeBaseItem::getName).containsExactlyElementsOf(lastRows);
        assertThat(result.getPageInfo())
                .returns(false, PageInfo::isHasNextPage)
                .returns(rowsBeforeThePage, PageInfo::isHasPreviousPage);
        assertThat(result.getFilteredCount()).isEqualTo(folderCount + articleCount);
    }

    @ParameterizedTest(name = "backward={0}, cursor of {1}")
    @MethodSource("pagesOfThreeFoldersAndFourArticles")
    void queryItems_eachPageInEachDirection_rowsInDisplayOrderWithBothFlags(
            boolean backward, String anchorName, List<String> expectedRows,
            boolean hasPreviousPage, boolean hasNextPage) {
        // setup
        stubKnowledgeBase(3, 4);
        String cursor = cursorOfRowNamed(anchorName);
        CursorPaginationCriteria pagination = connectionPage(backward, 2, cursor);

        // execution
        CountedGenericQueryResult<KnowledgeBaseItem> result = service.queryItems(NO_FILTER, null, pagination);

        // verifications
        assertThat(result.getItems()).extracting(KnowledgeBaseItem::getName).containsExactlyElementsOf(expectedRows);
        assertThat(result.getPageInfo())
                .returns(hasPreviousPage, PageInfo::isHasPreviousPage)
                .returns(hasNextPage, PageInfo::isHasNextPage);
    }

    @ParameterizedTest(name = "{0} folders")
    @CsvSource({
            "0, false",
            "1, true",
            "3, true"
    })
    void queryItems_backwardPageThatStartsAtTheFirstArticle_hasAPreviousPageOnlyWhenFoldersExist(
            int folderCount, boolean hasPreviousPage) {
        // setup
        stubKnowledgeBase(folderCount, 4);
        String beforeTheThirdArticle = cursorOfRowNamed("scanner");

        // execution
        CountedGenericQueryResult<KnowledgeBaseItem> result =
                service.queryItems(NO_FILTER, null, backward(2, beforeTheThirdArticle));

        // verifications
        assertThat(result.getItems()).extracting(KnowledgeBaseItem::getName).containsExactly("vpn", "printer");
        assertThat(result.getPageInfo())
                .returns(hasPreviousPage, PageInfo::isHasPreviousPage)
                .returns(true, PageInfo::isHasNextPage);
    }

    @Test
    void queryItems_beforeAFolderCursor_readsOnlyTheFoldersBeforeIt() {
        // setup
        stubKnowledgeBase(3, 4);
        KnowledgeBaseItemCursor bravo = KnowledgeBaseItemCursor.of(rowNamed("Bravo"));

        // execution
        CountedGenericQueryResult<KnowledgeBaseItem> result =
                service.queryItems(NO_FILTER, null, backward(5, cursorOfRowNamed("Bravo")));

        // verifications
        assertThat(result.getItems()).extracting(KnowledgeBaseItem::getName).containsExactly("Alpha", "alpha");
        verify(repository).findFolders(ROOT, null, null, bravo, true, 6);
        verify(repository, never()).findArticles(eq(ROOT), isNull(), isNull(), isNull(),
                nullable(KnowledgeBaseItemCursor.class), anyBoolean(), anyInt());
    }

    @Test
    void queryItems_beforeAnArticleCursorWithFewerArticlesThanThePage_fillsTheRestFromTheEndOfTheFolders() {
        // setup
        stubKnowledgeBase(3, 4);
        KnowledgeBaseItemCursor printer = KnowledgeBaseItemCursor.of(rowNamed("printer"));

        // execution
        CountedGenericQueryResult<KnowledgeBaseItem> result =
                service.queryItems(NO_FILTER, null, backward(3, cursorOfRowNamed("printer")));

        // verifications
        assertThat(result.getItems()).extracting(KnowledgeBaseItem::getName).containsExactly("alpha", "Bravo", "vpn");
        verify(repository).findArticles(ROOT, null, null, null, printer, true, 4);
        verify(repository).findFolders(ROOT, null, null, null, true, 3);
    }

    @Test
    void queryItems_beforeAnArticleCursorWithAFullPageOfArticles_doesNotReadFolders() {
        // setup
        stubKnowledgeBase(3, 4);
        KnowledgeBaseItemCursor backup = KnowledgeBaseItemCursor.of(rowNamed("backup"));

        // execution
        CountedGenericQueryResult<KnowledgeBaseItem> result =
                service.queryItems(NO_FILTER, null, backward(2, cursorOfRowNamed("backup")));

        // verifications
        assertThat(result.getItems()).extracting(KnowledgeBaseItem::getName).containsExactly("printer", "scanner");
        verify(repository).findArticles(ROOT, null, null, null, backup, true, 3);
        verify(repository, never()).findFolders(eq(ROOT), isNull(), isNull(),
                nullable(KnowledgeBaseItemCursor.class), anyBoolean(), anyInt());
    }

    @Test
    void queryItems_backwardPage_pageInfoCursorsKeepTheTaggedFormat() {
        // setup
        stubKnowledgeBase(3, 4);
        String startCursor = KnowledgeBaseCursors.encode(rowNamed("Bravo"));
        String endCursor = KnowledgeBaseCursors.encode(rowNamed("vpn"));

        // execution
        PageInfo pageInfo = service.queryItems(NO_FILTER, null, backward(2, cursorOfRowNamed("printer"))).getPageInfo();

        // verifications
        assertThat(pageInfo)
                .returns(startCursor, PageInfo::getStartCursor)
                .returns(endCursor, PageInfo::getEndCursor);
    }

    @Test
    void queryItems_lastOnAFolderListing_returnsTheLastFoldersWithoutReadingArticles() {
        // setup
        stubKnowledgeBase(4, 3);

        // execution
        CountedGenericQueryResult<KnowledgeBaseItem> result = service.queryItems(FOLDERS_ONLY, null, backward(3, null));

        // verifications
        assertThat(result.getItems()).extracting(KnowledgeBaseItem::getName).containsExactly("alpha", "Bravo", "charlie");
        assertThat(result.getPageInfo())
                .returns(true, PageInfo::isHasPreviousPage)
                .returns(false, PageInfo::isHasNextPage);
        assertThat(result.getFilteredCount()).isEqualTo(4);
        verify(repository, never()).findArticles(eq(ROOT), isNull(), isNull(), isNull(),
                nullable(KnowledgeBaseItemCursor.class), anyBoolean(), anyInt());
    }

    @Test
    void queryItems_lastOnAnArticleListing_returnsTheLastArticlesWithoutReadingFolders() {
        // setup
        stubKnowledgeBase(4, 3);

        // execution
        CountedGenericQueryResult<KnowledgeBaseItem> result = service.queryItems(ARTICLES_ONLY, null, backward(5, null));

        // verifications
        assertThat(result.getItems()).extracting(KnowledgeBaseItem::getName).containsExactly("vpn", "printer", "scanner");
        assertThat(result.getPageInfo())
                .returns(false, PageInfo::isHasPreviousPage)
                .returns(false, PageInfo::isHasNextPage);
        assertThat(result.getFilteredCount()).isEqualTo(3);
        verify(repository, never()).findFolders(eq(ROOT), isNull(), isNull(),
                nullable(KnowledgeBaseItemCursor.class), anyBoolean(), anyInt());
    }

    @Test
    void queryItems_lastWithASearchAndStatuses_readsBothStreamsBackwardUnderTheSameFilters() {
        // setup
        List<KnowledgeBaseArticleStatus> statuses = List.of(KnowledgeBaseArticleStatus.PUBLISHED);
        KnowledgeBaseFilterCriteria published = KnowledgeBaseFilterCriteria.builder().statuses(statuses).build();
        KnowledgeBaseParentFilter everyLevel = KnowledgeBaseParentFilter.any();
        when(knowledgeBaseTagService.findItemIdsByTags(null)).thenReturn(null);

        // execution
        service.queryItems(published, SEARCH, backward(2, null));

        // verifications
        verify(repository).findArticles(everyLevel, SEARCH, null, statuses, null, true, 3);
        verify(repository).findFolders(everyLevel, SEARCH, null, null, true, 3);
    }

    @ParameterizedTest(name = "backward={0}")
    @MethodSource("rowsAroundARemovedFolder")
    void queryItems_taggedCursorOfARemovedRow_pagesFromThePositionItCarriesWithoutReadingTheRow(
            boolean backward, List<String> expectedRows) {
        // setup
        stubKnowledgeBase(4, 0);
        KnowledgeBaseItem removed = folder(GONE_ID, "beta");
        String cursor = KnowledgeBaseCursors.encode(removed);

        // execution
        CountedGenericQueryResult<KnowledgeBaseItem> result =
                service.queryItems(NO_FILTER, null, connectionPage(backward, 5, cursor));

        // verifications
        assertThat(result.getItems()).extracting(KnowledgeBaseItem::getName).containsExactlyElementsOf(expectedRows);
        verify(repository, never()).findCursorItem(GONE_ID);
        verify(repository, never()).findById(GONE_ID);
    }

    @ParameterizedTest(name = "backward={0}, bare id of {1}")
    @MethodSource("pagesFromABareRowId")
    void queryItems_bareIdOfAStoredRow_pagesFromThatRowReadWithTheScopedLookup(
            boolean backward, String anchorName, List<String> expectedRows) {
        // setup
        stubKnowledgeBase(3, 4);
        KnowledgeBaseItem anchor = rowNamed(anchorName);
        String rowId = anchor.getId();
        when(repository.findCursorItem(rowId)).thenReturn(Optional.of(anchor));
        CursorPaginationCriteria pagination =
                CursorPaginationCriteria.builder().cursor(rowId).backward(backward).limit(2).build();

        // execution
        CountedGenericQueryResult<KnowledgeBaseItem> result = service.queryItems(NO_FILTER, null, pagination);

        // verifications
        assertThat(result.getItems()).extracting(KnowledgeBaseItem::getName).containsExactlyElementsOf(expectedRows);
        verify(repository).findCursorItem(rowId);
        verify(repository, never()).findById(rowId);
    }

    @ParameterizedTest(name = "backward={0}, cursor {1}")
    @MethodSource("cursorsThatAreNotAPosition")
    void queryItems_cursorThatIsNotAPosition_throwsInvalidCursorWithoutReadingAPage(boolean backward, String cursor) {
        // setup
        CursorPaginationCriteria pagination =
                CursorPaginationCriteria.builder().cursor(cursor).backward(backward).limit(2).build();

        // execution
        Throwable thrown = catchThrowable(() -> service.queryItems(NO_FILTER, null, pagination));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verify(repository, atMostOnce()).findCursorItem(cursor);
        verifyNoMoreInteractions(repository);
    }

    @ParameterizedTest(name = "backward={0}, cursor {1}")
    @MethodSource("taggedCursorsWithAnUnreadableSortKey")
    void queryItems_taggedCursorWithAnUnreadableSortKey_throwsInvalidCursorWithoutARowLookup(
            boolean backward, String cursor) {
        // setup
        CursorPaginationCriteria pagination =
                CursorPaginationCriteria.builder().cursor(cursor).backward(backward).limit(2).build();

        // execution
        Throwable thrown = catchThrowable(() -> service.queryItems(NO_FILTER, null, pagination));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verifyNoInteractions(repository);
    }

    @Test
    void queryArchivedArticles_pageOneThenPageTwoThenBeforePageTwo_returnsPageOneAgain() {
        // setup
        stubArchivedArticles(5);

        // execution
        CountedGenericQueryResult<KnowledgeBaseItem> pageOne = service.queryArchivedArticles(null, null, forward(2, null));
        CountedGenericQueryResult<KnowledgeBaseItem> pageTwo =
                service.queryArchivedArticles(null, null, forward(2, pageOne.getPageInfo().getEndCursor()));
        CountedGenericQueryResult<KnowledgeBaseItem> backToPageOne =
                service.queryArchivedArticles(null, null, backward(2, pageTwo.getPageInfo().getStartCursor()));

        // verifications
        assertThat(pageOne.getItems()).extracting(KnowledgeBaseItem::getName).containsExactly("vpn", "printer");
        assertThat(pageTwo.getItems()).extracting(KnowledgeBaseItem::getName).containsExactly("scanner", "backup");
        assertThat(backToPageOne.getItems()).extracting(KnowledgeBaseItem::getName).containsExactly("vpn", "printer");
        assertThat(backToPageOne.getPageInfo())
                .returns(pageOne.getPageInfo().getStartCursor(), PageInfo::getStartCursor)
                .returns(pageOne.getPageInfo().getEndCursor(), PageInfo::getEndCursor);
    }

    @ParameterizedTest(name = "backward={0}, cursor of {1}")
    @MethodSource("pagesOfFiveArchivedArticles")
    void queryArchivedArticles_eachPageInEachDirection_rowsInDisplayOrderWithBothFlags(
            boolean backward, String anchorName, List<String> expectedRows,
            boolean hasPreviousPage, boolean hasNextPage) {
        // setup
        stubArchivedArticles(5);
        String cursor = cursorOfRowNamed(anchorName);
        CursorPaginationCriteria pagination = connectionPage(backward, 2, cursor);

        // execution
        CountedGenericQueryResult<KnowledgeBaseItem> result = service.queryArchivedArticles(null, null, pagination);

        // verifications
        assertThat(result.getItems()).extracting(KnowledgeBaseItem::getName).containsExactlyElementsOf(expectedRows);
        assertThat(result.getPageInfo())
                .returns(hasPreviousPage, PageInfo::isHasPreviousPage)
                .returns(hasNextPage, PageInfo::isHasNextPage);
        assertThat(result.getFilteredCount()).isEqualTo(5);
    }

    @Test
    void queryArchivedArticles_lastWithoutBefore_lastRowsInDisplayOrderAndNoNextPage() {
        // setup
        stubArchivedArticles(5);

        // execution
        CountedGenericQueryResult<KnowledgeBaseItem> result = service.queryArchivedArticles(null, null, backward(2, null));

        // verifications
        assertThat(result.getItems()).extracting(KnowledgeBaseItem::getName).containsExactly("backup", "wifi");
        assertThat(result.getPageInfo())
                .returns(false, PageInfo::isHasNextPage)
                .returns(true, PageInfo::isHasPreviousPage);
        verify(repository).findArchivedArticles(null, null, null, true, 3);
    }

    @Test
    void queryArchivedArticles_lastLargerThanTheList_returnsEveryRowWithoutAPreviousPage() {
        // setup
        stubArchivedArticles(2);

        // execution
        CountedGenericQueryResult<KnowledgeBaseItem> result = service.queryArchivedArticles(null, null, backward(5, null));

        // verifications
        assertThat(result.getItems()).extracting(KnowledgeBaseItem::getName).containsExactly("vpn", "printer");
        assertThat(result.getPageInfo())
                .returns(false, PageInfo::isHasNextPage)
                .returns(false, PageInfo::isHasPreviousPage);
    }

    @Test
    void queryArchivedArticles_bareIdOfAStoredArticleBefore_pagesBackFromThatRowReadWithTheScopedLookup() {
        // setup
        stubArchivedArticles(5);
        KnowledgeBaseItem anchor = rowNamed("backup");
        String rowId = anchor.getId();
        when(repository.findCursorItem(rowId)).thenReturn(Optional.of(anchor));
        CursorPaginationCriteria pagination =
                CursorPaginationCriteria.builder().cursor(rowId).backward(true).limit(2).build();

        // execution
        CountedGenericQueryResult<KnowledgeBaseItem> result = service.queryArchivedArticles(null, null, pagination);

        // verifications
        assertThat(result.getItems()).extracting(KnowledgeBaseItem::getName).containsExactly("printer", "scanner");
        verify(repository, never()).findById(rowId);
    }

    @ParameterizedTest(name = "backward={0}, cursor {1}")
    @MethodSource("cursorsThatAreNotAPosition")
    void queryArchivedArticles_cursorThatIsNotAPosition_throwsInvalidCursorWithoutReadingAPage(
            boolean backward, String cursor) {
        // setup
        CursorPaginationCriteria pagination =
                CursorPaginationCriteria.builder().cursor(cursor).backward(backward).limit(2).build();

        // execution
        Throwable thrown = catchThrowable(() -> service.queryArchivedArticles(null, null, pagination));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verify(repository, atMostOnce()).findCursorItem(cursor);
        verifyNoMoreInteractions(repository);
    }

    @ParameterizedTest(name = "backward={0}")
    @CsvSource({"false", "true"})
    void queryArchivedArticles_folderCursor_throwsInvalidCursorWithoutReadingAPage(boolean backward) {
        // setup
        KnowledgeBaseItem folder = folder("65f1a2b3c4d5e6f708192a30", "Bravo");
        CursorPaginationCriteria pagination = connectionPage(backward, 2, KnowledgeBaseCursors.encode(folder));

        // execution
        Throwable thrown = catchThrowable(() -> service.queryArchivedArticles(null, null, pagination));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verifyNoInteractions(repository);
    }

    private void stubKnowledgeBase(int folderCount, int articleCount) {
        folders = FOLDERS_IN_DISPLAY_ORDER.subList(0, folderCount);
        articles = ARTICLES_IN_DISPLAY_ORDER.subList(0, articleCount);
        lenient().when(knowledgeBaseTagService.findItemIdsByTags(null)).thenReturn(null);
        lenient().when(repository.countFolders(ROOT, null, null)).thenReturn((long) folderCount);
        lenient().when(repository.findFolders(eq(ROOT), isNull(), isNull(),
                        nullable(KnowledgeBaseItemCursor.class), anyBoolean(), anyInt()))
                .thenAnswer(call -> rowsPast(folders, FOLDER_ORDER,
                        call.getArgument(3), call.getArgument(4), call.getArgument(5)));
        lenient().when(repository.countArticles(ROOT, null, null, null)).thenReturn((long) articleCount);
        lenient().when(repository.findArticles(eq(ROOT), isNull(), isNull(), isNull(),
                        nullable(KnowledgeBaseItemCursor.class), anyBoolean(), anyInt()))
                .thenAnswer(call -> rowsPast(articles, ARTICLE_ORDER,
                        call.getArgument(4), call.getArgument(5), call.getArgument(6)));
    }

    private void stubArchivedArticles(int articleCount) {
        articles = ARTICLES_IN_DISPLAY_ORDER.subList(0, articleCount);
        when(knowledgeBaseTagService.findItemIdsByTags(null)).thenReturn(null);
        when(repository.countArchivedArticles(null, null)).thenReturn((long) articleCount);
        when(repository.findArchivedArticles(isNull(), isNull(),
                nullable(KnowledgeBaseItemCursor.class), anyBoolean(), anyInt()))
                .thenAnswer(call -> rowsPast(articles, ARTICLE_ORDER,
                        call.getArgument(2), call.getArgument(3), call.getArgument(4)));
    }

    private static List<KnowledgeBaseItem> rowsPast(List<KnowledgeBaseItem> stream,
                                                    Comparator<KnowledgeBaseItemCursor> displayOrder,
                                                    KnowledgeBaseItemCursor bound, boolean backward, int limit) {
        Comparator<KnowledgeBaseItemCursor> fetchOrder = backward ? displayOrder.reversed() : displayOrder;
        return stream.stream()
                .filter(row -> bound == null || fetchOrder.compare(KnowledgeBaseItemCursor.of(row), bound) > 0)
                .sorted(Comparator.comparing(KnowledgeBaseItemCursor::of, fetchOrder))
                .limit(limit)
                .toList();
    }

    private List<CountedGenericQueryResult<KnowledgeBaseItem>> walkForward(int pageSize) {
        List<CountedGenericQueryResult<KnowledgeBaseItem>> pages = new ArrayList<>();
        String after = null;
        boolean hasNextPage = true;
        while (hasNextPage && pages.size() < MAX_PAGES) {
            CountedGenericQueryResult<KnowledgeBaseItem> page = service.queryItems(NO_FILTER, null, forward(pageSize, after));
            pages.add(page);
            hasNextPage = page.getPageInfo().isHasNextPage();
            after = page.getPageInfo().getEndCursor();
        }
        return pages;
    }

    private List<CountedGenericQueryResult<KnowledgeBaseItem>> pagesBeforeEachStart(
            List<CountedGenericQueryResult<KnowledgeBaseItem>> forwardPages, int pageSize) {
        return forwardPages.stream()
                .skip(1)
                .map(page -> page.getPageInfo().getStartCursor())
                .map(startCursor -> service.queryItems(NO_FILTER, null, backward(pageSize, startCursor)))
                .toList();
    }

    private static List<Tuple> rowsAndCursorsOf(List<CountedGenericQueryResult<KnowledgeBaseItem>> pages) {
        return pages.stream()
                .map(page -> tuple(
                        namesOf(page),
                        page.getPageInfo().getStartCursor(),
                        page.getPageInfo().getEndCursor()))
                .toList();
    }

    private static List<String> namesOf(CountedGenericQueryResult<KnowledgeBaseItem> page) {
        return page.getItems().stream().map(KnowledgeBaseItem::getName).toList();
    }

    private List<String> displayedNames() {
        return Stream.concat(folders.stream(), articles.stream()).map(KnowledgeBaseItem::getName).toList();
    }

    private static List<List<String>> pagesOf(List<String> rows, int pageSize) {
        List<List<String>> pages = new ArrayList<>();
        for (int start = 0; start < rows.size(); start += pageSize) {
            pages.add(rows.subList(start, Math.min(rows.size(), start + pageSize)));
        }
        return pages;
    }

    private static List<String> lastNames(List<String> rows, int count) {
        return rows.subList(Math.max(0, rows.size() - count), rows.size());
    }

    private KnowledgeBaseItem rowNamed(String name) {
        return Stream.concat(folders.stream(), articles.stream())
                .filter(row -> row.getName().equals(name))
                .findFirst()
                .orElseThrow();
    }

    private String cursorOfRowNamed(String name) {
        return name == null ? null : KnowledgeBaseCursors.encode(rowNamed(name));
    }

    private static CursorPaginationCriteria connectionPage(boolean backward, int size, String cursor) {
        return backward ? backward(size, cursor) : forward(size, cursor);
    }

    private static CursorPaginationCriteria forward(int first, String after) {
        return CursorPaginationCriteria.fromConnectionArgs(ConnectionArgs.builder().first(first).after(after).build());
    }

    private static CursorPaginationCriteria backward(int last, String before) {
        return CursorPaginationCriteria.fromConnectionArgs(ConnectionArgs.builder().last(last).before(before).build());
    }

    private static KnowledgeBaseItem folder(String id, String name) {
        return KnowledgeBaseItem.builder().id(id).type(KnowledgeBaseItemType.FOLDER).name(name).build();
    }

    private static KnowledgeBaseItem article(String id, String name, Instant updatedAt) {
        return KnowledgeBaseItem.builder()
                .id(id)
                .type(KnowledgeBaseItemType.ARTICLE)
                .name(name)
                .updatedAt(updatedAt)
                .build();
    }

    private static Stream<Arguments> knowledgeBasesOfMoreThanOnePage() {
        return Stream.of(
                arguments(0, 5, 2),
                arguments(0, 5, 3),
                arguments(5, 0, 2),
                arguments(5, 0, 3),
                arguments(2, 4, 2),
                arguments(3, 4, 3),
                arguments(3, 4, 2),
                arguments(4, 4, 3),
                arguments(5, 2, 3),
                arguments(4, 3, 2),
                arguments(6, 4, 3),
                arguments(4, 4, 2),
                arguments(6, 5, 1),
                arguments(1, 1, 1),
                arguments(6, 5, 4));
    }

    private static Stream<Arguments> knowledgeBasesOfAnySize() {
        return Stream.concat(
                knowledgeBasesOfMoreThanOnePage(),
                Stream.of(
                        arguments(0, 0, 2),
                        arguments(1, 1, 2),
                        arguments(1, 1, 3),
                        arguments(2, 0, 3),
                        arguments(0, 2, 3),
                        arguments(3, 0, 3),
                        arguments(0, 3, 3)));
    }

    private static Stream<Arguments> pagesOfThreeFoldersAndFourArticles() {
        return Stream.of(
                arguments(false, null, List.of("Alpha", "alpha"), false, true),
                arguments(false, "alpha", List.of("Bravo", "vpn"), true, true),
                arguments(false, "vpn", List.of("printer", "scanner"), true, true),
                arguments(false, "scanner", List.of("backup"), true, false),
                arguments(false, "backup", List.of(), true, false),
                arguments(true, "backup", List.of("printer", "scanner"), true, true),
                arguments(true, "scanner", List.of("vpn", "printer"), true, true),
                arguments(true, "printer", List.of("Bravo", "vpn"), true, true),
                arguments(true, "vpn", List.of("alpha", "Bravo"), true, true),
                arguments(true, "Bravo", List.of("Alpha", "alpha"), false, true),
                arguments(true, "alpha", List.of("Alpha"), false, true),
                arguments(true, "Alpha", List.of(), false, true));
    }

    private static Stream<Arguments> pagesOfFiveArchivedArticles() {
        return Stream.of(
                arguments(false, null, List.of("vpn", "printer"), false, true),
                arguments(false, "printer", List.of("scanner", "backup"), true, true),
                arguments(false, "backup", List.of("wifi"), true, false),
                arguments(true, "wifi", List.of("scanner", "backup"), true, true),
                arguments(true, "backup", List.of("printer", "scanner"), true, true),
                arguments(true, "scanner", List.of("vpn", "printer"), false, true),
                arguments(true, "vpn", List.of(), false, true));
    }

    private static Stream<Arguments> rowsAroundARemovedFolder() {
        return Stream.of(
                arguments(false, List.of("Bravo", "charlie")),
                arguments(true, List.of("Alpha", "alpha")));
    }

    private static Stream<Arguments> pagesFromABareRowId() {
        return Stream.of(
                arguments(false, "alpha", List.of("Bravo", "vpn")),
                arguments(false, "vpn", List.of("printer", "scanner")),
                arguments(true, "Bravo", List.of("Alpha", "alpha")),
                arguments(true, "printer", List.of("Bravo", "vpn")));
    }

    private static Stream<Arguments> cursorsThatAreNotAPosition() {
        return Stream.of(false, true).flatMap(backward -> Stream.of(
                arguments(backward, GONE_ID),
                arguments(backward, "not-an-id"),
                arguments(backward, "X:" + GONE_ID + ":1"),
                arguments(backward, "A::1760000000000"),
                arguments(backward, UNREADABLE_MILLIS_TAG),
                arguments(backward, UNREADABLE_NAME_TAG)));
    }

    private static Stream<Arguments> taggedCursorsWithAnUnreadableSortKey() {
        return Stream.of(false, true).flatMap(backward -> Stream.of(
                arguments(backward, UNREADABLE_MILLIS_TAG),
                arguments(backward, UNREADABLE_NAME_TAG)));
    }
}
