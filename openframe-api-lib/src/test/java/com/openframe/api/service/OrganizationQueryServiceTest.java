package com.openframe.api.service;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.organization.OrganizationFilterOptions;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.repository.organization.OrganizationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link OrganizationQueryService}. The repository is mocked so
 * these focus on the service-level contract: total count reporting and the
 * sort-aware cursor encoding.
 */
class OrganizationQueryServiceTest {

    private OrganizationRepository repository;
    private OrganizationQueryService service;

    @BeforeEach
    void setUp() {
        repository = mock(OrganizationRepository.class);
        service = new OrganizationQueryService(repository);
        when(repository.buildOrganizationQuery(any(), any())).thenReturn(new Query());
        when(repository.isSortableField(any())).thenReturn(true);
    }

    private static Organization org(String id, long updatedAtMillis) {
        return Organization.builder().id(id).updatedAt(Instant.ofEpochMilli(updatedAtMillis)).build();
    }

    private static SortInput lastActivity(SortDirection direction) {
        return SortInput.builder().field("updatedAt").direction(direction).build();
    }

    private static CursorPaginationCriteria page(int limit) {
        return CursorPaginationCriteria.builder().limit(limit).build();
    }

    @Test
    @DisplayName("filteredCount reports the total match count, not the current page size")
    void filteredCountIsTotalNotPageSize() {
        when(repository.countOrganizations(any())).thenReturn(137L);
        when(repository.findOrganizationsWithCursor(any(), any(), anyInt(), any(), any()))
                .thenReturn(List.of(org("a", 3), org("b", 2), org("c", 1)));

        CountedGenericQueryResult<Organization> result = service.queryOrganizations(
                OrganizationFilterOptions.builder().build(), page(20), null, lastActivity(SortDirection.DESC));

        assertThat(result.getFilteredCount()).isEqualTo(137);
        assertThat(result.getItems()).hasSize(3);
    }

    @Test
    @DisplayName("hasNextPage is true when a full page (== limit) is returned after trimming")
    void hasNextPageWhenFull() {
        when(repository.countOrganizations(any())).thenReturn(10L);
        // limit=2 -> service fetches limit+1=3 and trims to 2 -> a further page exists
        when(repository.findOrganizationsWithCursor(any(), any(), anyInt(), any(), any()))
                .thenReturn(List.of(org("a", 3), org("b", 2), org("c", 1)));

        CountedGenericQueryResult<Organization> result = service.queryOrganizations(
                OrganizationFilterOptions.builder().build(), page(2), null, lastActivity(SortDirection.DESC));

        assertThat(result.getItems()).hasSize(2);
        assertThat(result.getPageInfo().isHasNextPage()).isTrue();
    }

    @Test
    @DisplayName("last-activity sort emits compound <millis>_<id> page cursors")
    void compoundCursorForLastActivitySort() {
        when(repository.countOrganizations(any())).thenReturn(2L);
        when(repository.findOrganizationsWithCursor(any(), any(), anyInt(), any(), any()))
                .thenReturn(List.of(org("id-first", 500), org("id-last", 100)));

        CountedGenericQueryResult<Organization> result = service.queryOrganizations(
                OrganizationFilterOptions.builder().build(), page(20), null, lastActivity(SortDirection.DESC));

        assertThat(CursorCodec.decode(result.getPageInfo().getStartCursor())).isEqualTo("500_id-first");
        assertThat(CursorCodec.decode(result.getPageInfo().getEndCursor())).isEqualTo("100_id-last");
    }

    @Test
    @DisplayName("legacy _id sort keeps a plain ObjectId cursor")
    void plainCursorForLegacyIdSort() {
        when(repository.countOrganizations(any())).thenReturn(1L);
        when(repository.findOrganizationsWithCursor(any(), any(), anyInt(), any(), any()))
                .thenReturn(List.of(org("plain-id", 9)));

        CountedGenericQueryResult<Organization> result = service.queryOrganizations(
                OrganizationFilterOptions.builder().build(), page(20), null,
                SortInput.builder().field("_id").direction(SortDirection.DESC).build());

        assertThat(CursorCodec.decode(result.getPageInfo().getEndCursor())).isEqualTo("plain-id");
    }
}
