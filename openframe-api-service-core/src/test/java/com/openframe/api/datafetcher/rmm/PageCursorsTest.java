package com.openframe.api.datafetcher.rmm;

import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.PageResult;
import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.InvalidCursorException;
import com.openframe.core.exception.ValidationException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.junit.jupiter.params.provider.Arguments.arguments;

class PageCursorsTest {

    private static final int PAGE_SIZE = 20;
    private static final String INVALID_CURSOR = "Invalid cursor";
    private static final String BEFORE_REQUIRED = "before is required with last on this list";

    @ParameterizedTest(name = "first={0}, last={1} -> {2}")
    @CsvSource(nullValues = "null", value = {
            "null, null, 20",
            "0,    null, 20",
            "-5,   null, 20",
            "1,    null, 1",
            "20,   null, 20",
            "100,  null, 100",
            "101,  null, 100",
            "5000, null, 100",
            "null, 30,   30",
            "null, 500,  100",
            "10,   50,   10"
    })
    void pageSize_boundsTheRequestedSize(Integer first, Integer last, int expected) {
        // execution
        int size = PageCursors.pageSize(first, last);

        // verifications
        assertThat(size).isEqualTo(expected);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "   "})
    void resolvePage_noCursor_firstPage(String cursor) {
        // execution
        int page = PageCursors.resolvePage(PAGE_SIZE, cursor, null, cursor);

        // verifications
        assertThat(page).isZero();
    }

    @ParameterizedTest
    @ValueSource(ints = {0, 1, 3, 250})
    void resolvePage_after_thePageOfTheCursor(int cursorPage) {
        // setup
        String after = PageCursors.encodePage(cursorPage);

        // execution
        int page = PageCursors.resolvePage(PAGE_SIZE, after, null, null);

        // verifications
        assertThat(page).isEqualTo(cursorPage);
    }

    @ParameterizedTest
    @CsvSource({
            "1,   0",
            "3,   2",
            "250, 249"
    })
    void resolvePage_lastAndBefore_thePageBeforeTheCursor(int cursorPage, int expected) {
        // setup
        String before = PageCursors.encodePage(cursorPage);

        // execution
        int page = PageCursors.resolvePage(null, null, PAGE_SIZE, before);

        // verifications
        assertThat(page).isEqualTo(expected);
    }

    @Test
    void resolvePage_beforeWithoutLast_thePageBeforeTheCursor() {
        // setup
        String before = PageCursors.encodePage(3);

        // execution
        int page = PageCursors.resolvePage(PAGE_SIZE, null, null, before);

        // verifications
        assertThat(page).isEqualTo(2);
    }

    @Test
    void resolvePage_beforeTheFirstPage_firstPage() {
        // setup
        String before = PageCursors.encodePage(0);

        // execution
        int page = PageCursors.resolvePage(null, null, PAGE_SIZE, before);

        // verifications
        assertThat(page).isZero();
    }

    @Test
    void resolvePage_afterAndBefore_beforeWins() {
        // setup
        String after = PageCursors.encodePage(5);
        String before = PageCursors.encodePage(2);

        // execution
        int page = PageCursors.resolvePage(PAGE_SIZE, after, PAGE_SIZE, before);

        // verifications
        assertThat(page).isEqualTo(1);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "   "})
    void resolvePage_afterWithoutBefore_afterUsed(String before) {
        // setup
        String after = PageCursors.encodePage(4);

        // execution
        int page = PageCursors.resolvePage(PAGE_SIZE, after, null, before);

        // verifications
        assertThat(page).isEqualTo(4);
    }

    @ParameterizedTest
    @MethodSource("lastWithoutBefore")
    void resolvePage_lastWithoutBefore_throwsValidationError(Integer first, String after, String before) {
        // execution
        Throwable thrown = catchThrowable(() -> PageCursors.resolvePage(first, after, PAGE_SIZE, before));

        // verifications
        assertThat(thrown)
                .isInstanceOf(ValidationException.class)
                .hasMessage(BEFORE_REQUIRED);
        assertThat(((ValidationException) thrown).getErrorCode()).isEqualTo(ErrorCode.VALIDATION_ERROR);
    }

    @ParameterizedTest
    @MethodSource("cursorsThatAreNotAPage")
    void resolvePage_afterIsNotAPageCursor_throwsInvalidCursor(String after) {
        // execution
        Throwable thrown = catchThrowable(() -> PageCursors.resolvePage(PAGE_SIZE, after, null, null));

        // verifications
        assertThat(thrown)
                .isInstanceOf(InvalidCursorException.class)
                .hasMessage(INVALID_CURSOR);
    }

    @ParameterizedTest
    @MethodSource("cursorsThatAreNotAPage")
    void resolvePage_beforeIsNotAPageCursor_throwsInvalidCursor(String before) {
        // execution
        Throwable thrown = catchThrowable(() -> PageCursors.resolvePage(null, null, PAGE_SIZE, before));

        // verifications
        assertThat(thrown)
                .isInstanceOf(InvalidCursorException.class)
                .hasMessage(INVALID_CURSOR);
    }

    @Test
    void toConnection_pageWithRowsAndANextPage_startCursorOfThePageAndEndCursorOfTheNext() {
        // setup
        PageResult<String> page = new PageResult<>(List.of("a", "b"), true, true, 50, 2);
        String currentPage = PageCursors.encodePage(2);
        String nextPage = PageCursors.encodePage(3);

        // execution
        CountedGenericConnection<GenericEdge<String>> connection = PageCursors.toConnection(page);

        // verifications
        assertThat(connection.getEdges()).extracting(GenericEdge::getNode).containsExactly("a", "b");
        assertThat(connection.getEdges()).extracting(GenericEdge::getCursor).containsOnly(currentPage);
        assertThat(connection.getFilteredCount()).isEqualTo(50);
        assertThat(connection.getPageInfo())
                .returns(true, PageInfo::isHasNextPage)
                .returns(true, PageInfo::isHasPreviousPage)
                .returns(currentPage, PageInfo::getStartCursor)
                .returns(nextPage, PageInfo::getEndCursor);
    }

    @Test
    void toConnection_lastPageWithRows_bothCursorsOfThePage() {
        // setup
        PageResult<String> page = new PageResult<>(List.of("y", "z"), false, true, 42, 2);
        String currentPage = PageCursors.encodePage(2);

        // execution
        CountedGenericConnection<GenericEdge<String>> connection = PageCursors.toConnection(page);

        // verifications
        assertThat(connection.getPageInfo())
                .returns(false, PageInfo::isHasNextPage)
                .returns(true, PageInfo::isHasPreviousPage)
                .returns(currentPage, PageInfo::getStartCursor)
                .returns(currentPage, PageInfo::getEndCursor);
    }

    @Test
    void toConnection_emptyPagePastTheEnd_startCursorOfThatPageSoThePreviousOneCanBeAsked() {
        // setup
        PageResult<String> page = new PageResult<>(List.of(), false, true, 42, 7);
        String currentPage = PageCursors.encodePage(7);

        // execution
        CountedGenericConnection<GenericEdge<String>> connection = PageCursors.toConnection(page);

        // verifications
        assertThat(connection.getEdges()).isEmpty();
        assertThat(connection.getPageInfo())
                .returns(false, PageInfo::isHasNextPage)
                .returns(true, PageInfo::isHasPreviousPage)
                .returns(currentPage, PageInfo::getStartCursor)
                .returns(null, PageInfo::getEndCursor);
    }

    @Test
    void toConnection_emptyFirstPage_noCursors() {
        // setup
        PageResult<String> page = PageResult.empty(0);

        // execution
        CountedGenericConnection<GenericEdge<String>> connection = PageCursors.toConnection(page);

        // verifications
        assertThat(connection.getEdges()).isEmpty();
        assertThat(connection.getPageInfo())
                .returns(false, PageInfo::isHasNextPage)
                .returns(false, PageInfo::isHasPreviousPage)
                .returns(null, PageInfo::getStartCursor)
                .returns(null, PageInfo::getEndCursor);
    }

    @Test
    void resolvePage_startCursorOfAPageSentAsBefore_thePageBeforeIt() {
        // setup
        PageResult<String> secondPage = new PageResult<>(List.of("c", "d"), true, true, 50, 1);
        String startCursor = PageCursors.toConnection(secondPage).getPageInfo().getStartCursor();

        // execution
        int page = PageCursors.resolvePage(null, null, PAGE_SIZE, startCursor);

        // verifications
        assertThat(page).isZero();
    }

    @Test
    void resolvePage_endCursorOfAPageSentAsAfter_thePageAfterIt() {
        // setup
        PageResult<String> secondPage = new PageResult<>(List.of("c", "d"), true, true, 50, 1);
        String endCursor = PageCursors.toConnection(secondPage).getPageInfo().getEndCursor();

        // execution
        int page = PageCursors.resolvePage(PAGE_SIZE, endCursor, null, null);

        // verifications
        assertThat(page).isEqualTo(2);
    }

    @Test
    void resolvePage_startCursorOfAnEmptyPagePastTheEndSentAsBefore_thePageBeforeIt() {
        // setup
        PageResult<String> pastTheEnd = new PageResult<>(List.of(), false, true, 42, 7);
        String startCursor = PageCursors.toConnection(pastTheEnd).getPageInfo().getStartCursor();

        // execution
        int page = PageCursors.resolvePage(null, null, PAGE_SIZE, startCursor);

        // verifications
        assertThat(page).isEqualTo(6);
    }

    private static Stream<Arguments> lastWithoutBefore() {
        String after = PageCursors.encodePage(2);
        return Stream.of(
                arguments(null, null, null),
                arguments(null, null, ""),
                arguments(null, null, "   "),
                arguments(PAGE_SIZE, after, null));
    }

    private static Stream<Arguments> cursorsThatAreNotAPage() {
        return Stream.of(
                arguments("not base64 at all!"),
                arguments("%%%%"),
                arguments(urlSafeBase64("abc")),
                arguments(urlSafeBase64("1.5")),
                arguments(urlSafeBase64("-1")),
                arguments(urlSafeBase64("99999999999")),
                arguments(urlSafeBase64("65f1a2b3c4d5e6f708192a3b")),
                arguments(urlSafeBase64("k1|name|ASC|5|65f1a2b3c4d5e6f708192a3b")));
    }

    private static String urlSafeBase64(String text) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(text.getBytes(StandardCharsets.UTF_8));
    }
}
