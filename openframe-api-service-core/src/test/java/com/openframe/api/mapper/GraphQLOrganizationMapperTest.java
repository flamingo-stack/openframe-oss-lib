package com.openframe.api.mapper;

import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.organization.OrganizationFilterInput;
import com.openframe.api.dto.organization.OrganizationFilterOptions;
import com.openframe.api.dto.organization.OrganizationSortField;
import com.openframe.api.dto.organization.OrganizationSortInput;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.data.document.organization.Organization;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for {@link GraphQLOrganizationMapper} — the orderBy conversion,
 * last-activity filter mapping, and compound edge-cursor encoding.
 */
class GraphQLOrganizationMapperTest {

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
}
