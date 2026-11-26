package com.openframe.api.mapper;

import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.organization.OrganizationFilterInput;
import com.openframe.api.dto.organization.OrganizationFilterOptions;
import com.openframe.api.dto.organization.OrganizationSortField;
import com.openframe.api.dto.organization.OrganizationSortInput;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.InvalidCursorException;
import com.openframe.data.document.organization.Organization;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Unit tests for {@link GraphQLOrganizationMapper} — the orderBy conversion,
 * last-activity filter mapping, and compound edge-cursor encoding.
 */
class GraphQLOrganizationMapperTest {

    private static final String NOT_BASE64 = "%%%not-base64%%%";
    private static final String KEYSET_WITH_BOTH_ALPHABET_MARKS = "1700000000000_>ab?";
    private static final String STANDARD_ALPHABET_CURSOR = "MTcwMDAwMDAwMDAwMF8+YWI/";
    private static final String URL_SAFE_ALPHABET_CURSOR = "MTcwMDAwMDAwMDAwMF8-YWI_";

    private final GraphQLOrganizationMapper mapper = new GraphQLOrganizationMapper();

    @Test
    @DisplayName("orderBy omitted defaults to LAST_ACTIVITY DESC (updatedAt)")
    void toSortInputDefaultsToLastActivityDesc() {
        SortInput sort = mapper.toSortInput(null);

        assertThat(sort.getField()).isEqualTo("updatedAt");
        assertThat(sort.getDirection()).isEqualTo(SortDirection.DESC);
    }

    @Test
    @DisplayName("LAST_ACTIVITY maps to updatedAt and preserves direction")
    void toSortInputMapsAscending() {
        SortInput sort = mapper.toSortInput(OrganizationSortInput.builder()
                .field(OrganizationSortField.LAST_ACTIVITY)
                .direction(SortDirection.ASC)
                .build());

        assertThat(sort.getField()).isEqualTo("updatedAt");
        assertThat(sort.getDirection()).isEqualTo(SortDirection.ASC);
    }

    @Test
    @DisplayName("last-activity range is carried into filter options")
    void toFilterOptionsMapsLastActivityRange() {
        Instant from = Instant.ofEpochMilli(1_000);
        Instant to = Instant.ofEpochMilli(2_000);
        OrganizationFilterInput input = new OrganizationFilterInput();
        input.setLastActivityFrom(from);
        input.setLastActivityTo(to);

        OrganizationFilterOptions options = mapper.toFilterOptions(input);

        assertThat(options.getLastActivityFrom()).isEqualTo(from);
        assertThat(options.getLastActivityTo()).isEqualTo(to);
    }

    @Test
    @DisplayName("edge cursors are compound <millis>_<id> and filteredCount is propagated")
    void toOrganizationConnectionCompoundCursorAndCount() {
        Organization org = Organization.builder().id("the-id").updatedAt(Instant.ofEpochMilli(1234)).build();
        CountedGenericQueryResult<Organization> result = CountedGenericQueryResult.<Organization>builder()
                .items(List.of(org))
                .pageInfo(PageInfo.builder().build())
                .filteredCount(99)
                .build();

        CountedGenericConnection<GenericEdge<Organization>> connection = mapper.toOrganizationConnection(result);

        assertThat(connection.getFilteredCount()).isEqualTo(99);
        assertThat(connection.getEdges()).hasSize(1);
        assertThat(CursorCodec.decode(connection.getEdges().get(0).getCursor())).isEqualTo("1234_the-id");
    }

    @Test
    void toCursorPaginationCriteria_undecodableAfter_throwsInvalidCursor() {
        // setup
        ConnectionArgs args = ConnectionArgs.builder().first(2).after(NOT_BASE64).build();

        // execution
        InvalidCursorException ex = assertThrows(InvalidCursorException.class,
                () -> mapper.toCursorPaginationCriteria(args));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("Invalid cursor");
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.INVALID_CURSOR);
    }

    @Test
    void toCursorPaginationCriteria_undecodableBefore_throwsInvalidCursor() {
        // setup
        ConnectionArgs args = ConnectionArgs.builder().last(2).before(NOT_BASE64).build();

        // execution
        InvalidCursorException ex = assertThrows(InvalidCursorException.class,
                () -> mapper.toCursorPaginationCriteria(args));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("Invalid cursor");
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.INVALID_CURSOR);
    }

    @Test
    void toCursorPaginationCriteria_lastAndBefore_backwardCriteriaWithDecodedCursor() {
        // setup
        ConnectionArgs args = ConnectionArgs.builder().last(2).before(CursorCodec.encode("300_id-3")).build();

        // execution
        CursorPaginationCriteria criteria = mapper.toCursorPaginationCriteria(args);

        // verifications
        assertThat(criteria)
                .returns(true, CursorPaginationCriteria::isBackward)
                .returns(2, CursorPaginationCriteria::getLimit)
                .returns("300_id-3", CursorPaginationCriteria::getCursor);
    }

    @ParameterizedTest
    @ValueSource(strings = {STANDARD_ALPHABET_CURSOR, URL_SAFE_ALPHABET_CURSOR})
    void toCursorPaginationCriteria_afterInEitherBase64Alphabet_forwardCriteriaWithTheSameDecodedCursor(String after) {
        // setup
        ConnectionArgs args = ConnectionArgs.builder().first(2).after(after).build();

        // execution
        CursorPaginationCriteria criteria = mapper.toCursorPaginationCriteria(args);

        // verifications
        assertThat(criteria)
                .returns(false, CursorPaginationCriteria::isBackward)
                .returns(2, CursorPaginationCriteria::getLimit)
                .returns(KEYSET_WITH_BOTH_ALPHABET_MARKS, CursorPaginationCriteria::getCursor);
    }

    @ParameterizedTest
    @ValueSource(strings = {STANDARD_ALPHABET_CURSOR, URL_SAFE_ALPHABET_CURSOR})
    void toCursorPaginationCriteria_beforeInEitherBase64Alphabet_backwardCriteriaWithTheSameDecodedCursor(
            String before) {
        // setup
        ConnectionArgs args = ConnectionArgs.builder().last(2).before(before).build();

        // execution
        CursorPaginationCriteria criteria = mapper.toCursorPaginationCriteria(args);

        // verifications
        assertThat(criteria)
                .returns(true, CursorPaginationCriteria::isBackward)
                .returns(2, CursorPaginationCriteria::getLimit)
                .returns(KEYSET_WITH_BOTH_ALPHABET_MARKS, CursorPaginationCriteria::getCursor);
    }

    @Test
    void toCursorPaginationCriteria_noArguments_criteriaWithoutACursor() {
        // setup
        ConnectionArgs noArguments = null;

        // execution
        CursorPaginationCriteria criteria = mapper.toCursorPaginationCriteria(noArguments);

        // verifications
        assertThat(criteria)
                .returns(false, CursorPaginationCriteria::isBackward)
                .returns(false, CursorPaginationCriteria::hasCursor);
    }
}
