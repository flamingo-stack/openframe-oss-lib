package com.openframe.api.dto.shared;

import org.junit.jupiter.api.Test;

import java.util.Comparator;
import java.util.List;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

class CursorPageTest {

    private static final String CURSOR = "cursor-text";
    private static final List<Integer> ALL_ROWS = IntStream.rangeClosed(1, 7).boxed().toList();

    @Test
    void assemble_forwardFirstPageWithOneRowMore_trimmedWithANextPageOnly() {
        // setup
        CursorPaginationCriteria criteria = CursorPaginationCriteria.builder().limit(3).build();
        List<Integer> fetched = List.of(1, 2, 3, 4);

        // execution
        CursorPage<Integer> page = CursorPage.assemble(fetched, criteria);

        // verifications
        assertThat(page.items()).containsExactly(1, 2, 3);
        assertThat(page.hasNextPage()).isTrue();
        assertThat(page.hasPreviousPage()).isFalse();
    }

    @Test
    void assemble_forwardAfterACursorWithNoRowMore_allRowsWithAPreviousPageOnly() {
        // setup
        CursorPaginationCriteria criteria = CursorPaginationCriteria.builder().limit(3).cursor(CURSOR).build();
        List<Integer> fetched = List.of(5, 6, 7);

        // execution
        CursorPage<Integer> page = CursorPage.assemble(fetched, criteria);

        // verifications
        assertThat(page.items()).containsExactly(5, 6, 7);
        assertThat(page.hasNextPage()).isFalse();
        assertThat(page.hasPreviousPage()).isTrue();
    }

    @Test
    void assemble_forwardAfterACursorWithOneRowMore_bothPages() {
        // setup
        CursorPaginationCriteria criteria = CursorPaginationCriteria.builder().limit(2).cursor(CURSOR).build();
        List<Integer> fetched = List.of(3, 4, 5);

        // execution
        CursorPage<Integer> page = CursorPage.assemble(fetched, criteria);

        // verifications
        assertThat(page.items()).containsExactly(3, 4);
        assertThat(page.hasNextPage()).isTrue();
        assertThat(page.hasPreviousPage()).isTrue();
    }

    @Test
    void assemble_backwardBeforeACursorWithOneRowMore_trimmedAndReadBackInDisplayOrderWithBothPages() {
        // setup
        CursorPaginationCriteria criteria = CursorPaginationCriteria.builder()
                .limit(3).cursor(CURSOR).backward(true).build();
        List<Integer> fetched = List.of(6, 5, 4, 3);

        // execution
        CursorPage<Integer> page = CursorPage.assemble(fetched, criteria);

        // verifications
        assertThat(page.items()).containsExactly(4, 5, 6);
        assertThat(page.hasNextPage()).isTrue();
        assertThat(page.hasPreviousPage()).isTrue();
    }

    @Test
    void assemble_backwardBeforeACursorWithNoRowMore_noPreviousPage() {
        // setup
        CursorPaginationCriteria criteria = CursorPaginationCriteria.builder()
                .limit(3).cursor(CURSOR).backward(true).build();
        List<Integer> fetched = List.of(2, 1);

        // execution
        CursorPage<Integer> page = CursorPage.assemble(fetched, criteria);

        // verifications
        assertThat(page.items()).containsExactly(1, 2);
        assertThat(page.hasNextPage()).isTrue();
        assertThat(page.hasPreviousPage()).isFalse();
    }

    @Test
    void assemble_backwardWithoutACursor_lastRowsWithNoNextPage() {
        // setup
        CursorPaginationCriteria criteria = CursorPaginationCriteria.builder().limit(3).backward(true).build();
        List<Integer> fetched = List.of(7, 6, 5, 4);

        // execution
        CursorPage<Integer> page = CursorPage.assemble(fetched, criteria);

        // verifications
        assertThat(page.items()).containsExactly(5, 6, 7);
        assertThat(page.hasNextPage()).isFalse();
        assertThat(page.hasPreviousPage()).isTrue();
    }

    @Test
    void assemble_exactlyTheLimitFetched_noRowMore() {
        // setup
        CursorPaginationCriteria criteria = CursorPaginationCriteria.builder().limit(3).build();
        List<Integer> fetched = List.of(1, 2, 3);

        // execution
        CursorPage<Integer> page = CursorPage.assemble(fetched, criteria);

        // verifications
        assertThat(page.items()).containsExactly(1, 2, 3);
        assertThat(page.hasNextPage()).isFalse();
        assertThat(page.hasPreviousPage()).isFalse();
    }

    @Test
    void assemble_nothingFetchedForward_emptyPageWithoutPages() {
        // setup
        CursorPaginationCriteria criteria = CursorPaginationCriteria.builder().limit(3).build();
        List<Integer> fetched = List.of();

        // execution
        CursorPage<Integer> page = CursorPage.assemble(fetched, criteria);

        // verifications
        assertThat(page.items()).isEmpty();
        assertThat(page.hasNextPage()).isFalse();
        assertThat(page.hasPreviousPage()).isFalse();
    }

    @Test
    void assemble_nothingFetchedBackwardBeforeACursor_emptyPageWithANextPageOnly() {
        // setup
        CursorPaginationCriteria criteria = CursorPaginationCriteria.builder()
                .limit(3).cursor(CURSOR).backward(true).build();
        List<Integer> fetched = List.of();

        // execution
        CursorPage<Integer> page = CursorPage.assemble(fetched, criteria);

        // verifications
        assertThat(page.items()).isEmpty();
        assertThat(page.hasNextPage()).isTrue();
        assertThat(page.hasPreviousPage()).isFalse();
    }

    @Test
    void assemble_criteriaWithoutLimit_defaultPageSizeApplied() {
        // setup
        CursorPaginationCriteria criteria = new CursorPaginationCriteria();
        List<Integer> fetched = IntStream.rangeClosed(1, 21).boxed().toList();
        List<Integer> firstTwenty = IntStream.rangeClosed(1, 20).boxed().toList();

        // execution
        CursorPage<Integer> page = CursorPage.assemble(fetched, criteria);

        // verifications
        assertThat(page.items()).isEqualTo(firstTwenty);
        assertThat(page.hasNextPage()).isTrue();
    }

    @Test
    void assemble_limitAboveTheMaximum_maximumPageSizeApplied() {
        // setup
        CursorPaginationCriteria criteria = CursorPaginationCriteria.builder().limit(5000).build();
        List<Integer> fetched = IntStream.rangeClosed(1, 101).boxed().toList();

        // execution
        CursorPage<Integer> page = CursorPage.assemble(fetched, criteria);

        // verifications
        assertThat(page.items()).hasSize(100);
        assertThat(page.hasNextPage()).isTrue();
    }

    @Test
    void assemble_secondPageForwardThenBackFromItsFirstRow_theFirstPageAgain() {
        // setup
        CursorPaginationCriteria firstPageCriteria = CursorPaginationCriteria.builder().limit(3).build();
        CursorPage<Integer> firstPage = CursorPage.assemble(fetchAfter(null, 3), firstPageCriteria);
        Integer endOfFirstPage = firstPage.items().getLast();
        CursorPaginationCriteria secondPageCriteria = CursorPaginationCriteria.builder().limit(3).cursor(CURSOR).build();
        CursorPage<Integer> secondPage = CursorPage.assemble(fetchAfter(endOfFirstPage, 3), secondPageCriteria);
        Integer startOfSecondPage = secondPage.items().getFirst();
        CursorPaginationCriteria backCriteria = CursorPaginationCriteria.builder()
                .limit(3).cursor(CURSOR).backward(true).build();
        List<Integer> fetchedBack = fetchBefore(startOfSecondPage, 3);

        // execution
        CursorPage<Integer> pageBack = CursorPage.assemble(fetchedBack, backCriteria);

        // verifications
        assertThat(secondPage.items()).containsExactly(4, 5, 6);
        assertThat(pageBack.items()).isEqualTo(firstPage.items());
        assertThat(pageBack.hasNextPage()).isTrue();
        assertThat(pageBack.hasPreviousPage()).isFalse();
    }

    @Test
    void assemble_lastRowsThenBackFromTheirFirstRow_theRowsBeforeThem() {
        // setup
        CursorPaginationCriteria lastRowsCriteria = CursorPaginationCriteria.builder().limit(3).backward(true).build();
        CursorPage<Integer> lastRows = CursorPage.assemble(fetchBefore(null, 3), lastRowsCriteria);
        Integer startOfLastRows = lastRows.items().getFirst();
        CursorPaginationCriteria backCriteria = CursorPaginationCriteria.builder()
                .limit(3).cursor(CURSOR).backward(true).build();
        List<Integer> fetchedBack = fetchBefore(startOfLastRows, 3);

        // execution
        CursorPage<Integer> pageBack = CursorPage.assemble(fetchedBack, backCriteria);

        // verifications
        assertThat(lastRows.items()).containsExactly(5, 6, 7);
        assertThat(pageBack.items()).containsExactly(2, 3, 4);
        assertThat(pageBack.hasNextPage()).isTrue();
        assertThat(pageBack.hasPreviousPage()).isTrue();
    }

    private static List<Integer> fetchAfter(Integer cursorRow, int limit) {
        return ALL_ROWS.stream()
                .filter(row -> cursorRow == null || row > cursorRow)
                .limit(limit + 1L)
                .toList();
    }

    private static List<Integer> fetchBefore(Integer cursorRow, int limit) {
        return ALL_ROWS.stream()
                .sorted(Comparator.reverseOrder())
                .filter(row -> cursorRow == null || row < cursorRow)
                .limit(limit + 1L)
                .toList();
    }
}
