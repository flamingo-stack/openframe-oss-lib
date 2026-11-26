package com.openframe.api.dto.shared;

import com.openframe.data.repository.cursor.CursorPosition;
import com.openframe.data.repository.cursor.KeysetCursor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.data.domain.Sort;

import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

class PositionPaginationCriteriaTest {

    private static final String ROW_HEX = "65f1a2b3c4d5e6f708192a3b";
    private static final CursorPosition NO_POSITION = new CursorPosition.None();

    @Test
    void normalize_noLimit_defaultPageSize() {
        // setup
        PositionPaginationCriteria criteria = PositionPaginationCriteria.builder().build();

        // execution
        PositionPaginationCriteria normalized = criteria.normalize();

        // verifications
        assertThat(normalized.getLimit()).isEqualTo(20);
    }

    @ParameterizedTest
    @CsvSource({
            "-5, 1",
            "0, 1",
            "1, 1",
            "37, 37",
            "100, 100",
            "101, 100",
            "5000, 100"
    })
    void normalize_limitAgainstTheBounds_clampedIntoThePageSizeRange(int requested, int expected) {
        // setup
        PositionPaginationCriteria criteria = PositionPaginationCriteria.builder().limit(requested).build();

        // execution
        PositionPaginationCriteria normalized = criteria.normalize();

        // verifications
        assertThat(normalized.getLimit()).isEqualTo(expected);
    }

    @Test
    void normalize_noPosition_startOfTheList() {
        // setup
        PositionPaginationCriteria criteria = PositionPaginationCriteria.builder().limit(5).build();

        // execution
        PositionPaginationCriteria normalized = criteria.normalize();

        // verifications
        assertThat(normalized.getPosition()).isEqualTo(NO_POSITION);
        assertThat(normalized.isBackward()).isFalse();
    }

    @Test
    void normalize_positionAndDirectionGiven_bothKept() {
        // setup
        CursorPosition position = new CursorPosition.RowId(ROW_HEX);
        PositionPaginationCriteria criteria = PositionPaginationCriteria.builder()
                .position(position).limit(5).backward(true).build();

        // execution
        PositionPaginationCriteria normalized = criteria.normalize();

        // verifications
        assertThat(normalized.getPosition()).isEqualTo(position);
        assertThat(normalized.isBackward()).isTrue();
        assertThat(normalized.getLimit()).isEqualTo(5);
    }

    @Test
    void hasPosition_noPositionSet_false() {
        // setup
        PositionPaginationCriteria criteria = PositionPaginationCriteria.builder().build();

        // execution
        boolean hasPosition = criteria.hasPosition();

        // verifications
        assertThat(hasPosition).isFalse();
    }

    @Test
    void hasPosition_startOfTheList_false() {
        // setup
        PositionPaginationCriteria criteria = PositionPaginationCriteria.builder().position(NO_POSITION).build();

        // execution
        boolean hasPosition = criteria.hasPosition();

        // verifications
        assertThat(hasPosition).isFalse();
    }

    @ParameterizedTest
    @MethodSource("positionsACursorProduces")
    void hasPosition_positionOfACursor_true(CursorPosition position) {
        // setup
        PositionPaginationCriteria criteria = PositionPaginationCriteria.builder().position(position).build();

        // execution
        boolean hasPosition = criteria.hasPosition();

        // verifications
        assertThat(hasPosition).isTrue();
    }

    private static Stream<CursorPosition> positionsACursorProduces() {
        return Stream.of(
                new CursorPosition.RowId(ROW_HEX),
                new KeysetCursor("_id", Sort.Direction.DESC, "", ROW_HEX),
                new CursorPosition.Unrecognised("not-a-cursor"));
    }
}
