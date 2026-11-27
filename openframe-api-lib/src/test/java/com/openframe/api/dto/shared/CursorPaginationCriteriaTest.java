package com.openframe.api.dto.shared;

import com.openframe.core.exception.InvalidCursorException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

class CursorPaginationCriteriaTest {

    private static final String AFTER_TEXT = "1700000000123_row-after";
    private static final String BEFORE_TEXT = "1700000000456_row-before";
    private static final String AFTER = CursorCodec.encode(AFTER_TEXT);
    private static final String BEFORE = CursorCodec.encode(BEFORE_TEXT);
    private static final String NOT_BASE64 = "not base64 at all!";
    private static final String INVALID_CURSOR = "Invalid cursor";

    @Test
    void fromConnectionArgs_noArgs_emptyForwardCriteria() {
        // execution
        CursorPaginationCriteria criteria = CursorPaginationCriteria.fromConnectionArgs(null);

        // verifications
        assertThat(criteria)
                .returns(null, CursorPaginationCriteria::getLimit)
                .returns(null, CursorPaginationCriteria::getCursor)
                .returns(false, CursorPaginationCriteria::isBackward);
    }

    @Test
    void fromConnectionArgs_firstAndAfter_forwardFromTheDecodedCursor() {
        // setup
        ConnectionArgs args = ConnectionArgs.builder().first(30).after(AFTER).build();

        // execution
        CursorPaginationCriteria criteria = CursorPaginationCriteria.fromConnectionArgs(args);

        // verifications
        assertThat(criteria)
                .returns(30, CursorPaginationCriteria::getLimit)
                .returns(AFTER_TEXT, CursorPaginationCriteria::getCursor)
                .returns(false, CursorPaginationCriteria::isBackward);
    }

    @Test
    void fromConnectionArgs_lastAndBefore_backwardFromTheDecodedCursor() {
        // setup
        ConnectionArgs args = ConnectionArgs.builder().last(15).before(BEFORE).build();

        // execution
        CursorPaginationCriteria criteria = CursorPaginationCriteria.fromConnectionArgs(args);

        // verifications
        assertThat(criteria)
                .returns(15, CursorPaginationCriteria::getLimit)
                .returns(BEFORE_TEXT, CursorPaginationCriteria::getCursor)
                .returns(true, CursorPaginationCriteria::isBackward);
    }

    @Test
    void fromConnectionArgs_lastWithoutBefore_backwardWithoutCursor() {
        // setup
        ConnectionArgs args = ConnectionArgs.builder().last(15).build();

        // execution
        CursorPaginationCriteria criteria = CursorPaginationCriteria.fromConnectionArgs(args);

        // verifications
        assertThat(criteria)
                .returns(15, CursorPaginationCriteria::getLimit)
                .returns(null, CursorPaginationCriteria::getCursor)
                .returns(true, CursorPaginationCriteria::isBackward)
                .returns(false, CursorPaginationCriteria::hasCursor);
    }

    @Test
    void fromConnectionArgs_beforeWithoutLast_backwardWithoutLimit() {
        // setup
        ConnectionArgs args = ConnectionArgs.builder().first(30).before(BEFORE).build();

        // execution
        CursorPaginationCriteria criteria = CursorPaginationCriteria.fromConnectionArgs(args);

        // verifications
        assertThat(criteria)
                .returns(null, CursorPaginationCriteria::getLimit)
                .returns(BEFORE_TEXT, CursorPaginationCriteria::getCursor)
                .returns(true, CursorPaginationCriteria::isBackward);
    }

    @Test
    void fromConnectionArgs_bothDirections_backwardWins() {
        // setup
        ConnectionArgs args = ConnectionArgs.builder().first(30).after(AFTER).last(15).before(BEFORE).build();

        // execution
        CursorPaginationCriteria criteria = CursorPaginationCriteria.fromConnectionArgs(args);

        // verifications
        assertThat(criteria)
                .returns(15, CursorPaginationCriteria::getLimit)
                .returns(BEFORE_TEXT, CursorPaginationCriteria::getCursor)
                .returns(true, CursorPaginationCriteria::isBackward);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "   "})
    void fromConnectionArgs_blankAfter_forwardWithoutCursor(String after) {
        // setup
        ConnectionArgs args = ConnectionArgs.builder().first(30).after(after).build();

        // execution
        CursorPaginationCriteria criteria = CursorPaginationCriteria.fromConnectionArgs(args);

        // verifications
        assertThat(criteria)
                .returns(null, CursorPaginationCriteria::getCursor)
                .returns(false, CursorPaginationCriteria::isBackward);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "   "})
    void fromConnectionArgs_blankBefore_backwardWithoutCursor(String before) {
        // setup
        ConnectionArgs args = ConnectionArgs.builder().last(15).before(before).build();

        // execution
        CursorPaginationCriteria criteria = CursorPaginationCriteria.fromConnectionArgs(args);

        // verifications
        assertThat(criteria)
                .returns(null, CursorPaginationCriteria::getCursor)
                .returns(true, CursorPaginationCriteria::isBackward);
    }

    @Test
    void fromConnectionArgs_afterIsNotBase64_throwsInvalidCursor() {
        // setup
        ConnectionArgs args = ConnectionArgs.builder().first(30).after(NOT_BASE64).build();

        // execution
        Throwable thrown = catchThrowable(() -> CursorPaginationCriteria.fromConnectionArgs(args));

        // verifications
        assertThat(thrown)
                .isInstanceOf(InvalidCursorException.class)
                .hasMessage(INVALID_CURSOR);
    }

    @Test
    void fromConnectionArgs_beforeIsNotBase64_throwsInvalidCursor() {
        // setup
        ConnectionArgs args = ConnectionArgs.builder().last(15).before(NOT_BASE64).build();

        // execution
        Throwable thrown = catchThrowable(() -> CursorPaginationCriteria.fromConnectionArgs(args));

        // verifications
        assertThat(thrown)
                .isInstanceOf(InvalidCursorException.class)
                .hasMessage(INVALID_CURSOR);
    }

    @ParameterizedTest
    @CsvSource({
            "fn5+fn5+Pz8/Pz8/, ~~~~~~??????",
            "fn5-fn5-Pz8_Pz8_, ~~~~~~??????"
    })
    void fromConnectionArgs_cursorInStandardOrUrlSafeAlphabet_sameDecodedCursor(String after, String expected) {
        // setup
        ConnectionArgs args = ConnectionArgs.builder().first(30).after(after).build();

        // execution
        CursorPaginationCriteria criteria = CursorPaginationCriteria.fromConnectionArgs(args);

        // verifications
        assertThat(criteria.getCursor()).isEqualTo(expected);
    }

    @ParameterizedTest
    @CsvSource(nullValues = "null", value = {
            "null, 20",
            "-3,   1",
            "0,    1",
            "1,    1",
            "50,   50",
            "100,  100",
            "101,  100",
            "5000, 100"
    })
    void normalize_requestedLimit_defaultedAndClampedBetweenOneAndOneHundred(Integer requested, int expected) {
        // setup
        CursorPaginationCriteria criteria = CursorPaginationCriteria.builder()
                .limit(requested).cursor(AFTER_TEXT).backward(true).build();

        // execution
        CursorPaginationCriteria normalized = criteria.normalize();

        // verifications
        assertThat(normalized)
                .returns(expected, CursorPaginationCriteria::getLimit)
                .returns(AFTER_TEXT, CursorPaginationCriteria::getCursor)
                .returns(true, CursorPaginationCriteria::isBackward);
    }

    @Test
    void fromRest_cursorAndLimit_forwardFromTheDecodedCursor() {
        // execution
        CursorPaginationCriteria criteria = CursorPaginationCriteria.fromRest(AFTER, 50);

        // verifications
        assertThat(criteria)
                .returns(50, CursorPaginationCriteria::getLimit)
                .returns(AFTER_TEXT, CursorPaginationCriteria::getCursor)
                .returns(false, CursorPaginationCriteria::isBackward);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(ints = {0, 101})
    void fromRest_limitMissingOrOutOfRange_defaultPageSize(Integer limit) {
        // execution
        CursorPaginationCriteria criteria = CursorPaginationCriteria.fromRest(null, limit);

        // verifications
        assertThat(criteria.getLimit()).isEqualTo(20);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "   "})
    void hasCursor_nullOrBlankCursor_false(String cursor) {
        // setup
        CursorPaginationCriteria criteria = CursorPaginationCriteria.builder().cursor(cursor).build();

        // execution
        boolean hasCursor = criteria.hasCursor();

        // verifications
        assertThat(hasCursor).isFalse();
    }

    @Test
    void hasCursor_cursorText_true() {
        // setup
        CursorPaginationCriteria criteria = CursorPaginationCriteria.builder().cursor(AFTER_TEXT).build();

        // execution
        boolean hasCursor = criteria.hasCursor();

        // verifications
        assertThat(hasCursor).isTrue();
    }
}
