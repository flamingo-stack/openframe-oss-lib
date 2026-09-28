package com.openframe.api.service;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.audit.LogEvent;
import com.openframe.api.dto.audit.LogFilterCriteria;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.data.cassandra.repository.UnifiedLogEventRepository;
import com.openframe.data.pinot.model.LogProjection;
import com.openframe.data.pinot.repository.PinotLogRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.time.Instant;
import java.util.List;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link LogService#queryLogs}. The Pinot repository is mocked to
 * assert that the new timestamp-range bounds and the sort direction are threaded
 * through to the datastore query, and that a search term routes to searchLogs.
 */
class LogServiceTest {

    private static final Instant FROM = Instant.ofEpochMilli(1_000);
    private static final Instant TO = Instant.ofEpochMilli(2_000);

    private PinotLogRepository pinotLogRepository;
    private LogService service;

    @BeforeEach
    void setUp() {
        pinotLogRepository = mock(PinotLogRepository.class);
        UnifiedLogEventRepository unifiedLogEventRepository = mock(UnifiedLogEventRepository.class);
        TenantIdProvider tenantIdProvider = mock(TenantIdProvider.class);

        service = new LogService(pinotLogRepository, unifiedLogEventRepository, tenantIdProvider);

        when(tenantIdProvider.getTenantId()).thenReturn("t1");
        when(pinotLogRepository.isSortableField(any())).thenReturn(true);
        when(pinotLogRepository.getDefaultSortField()).thenReturn("eventTimestamp");
        when(pinotLogRepository.findLogs(any(), any(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), anyInt(), any(), any())).thenReturn(List.of());
        when(pinotLogRepository.searchLogs(any(), any(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any(), anyInt(), any(), any())).thenReturn(List.of());
    }

    private static LogFilterCriteria rangeFilter() {
        return LogFilterCriteria.builder().timestampFrom(FROM).timestampTo(TO).build();
    }

    private static CursorPaginationCriteria page() {
        return CursorPaginationCriteria.builder().limit(20).build();
    }

    @Test
    @DisplayName("timestamp range and ASC direction are passed to findLogs")
    void findLogsReceivesRangeAndDirection() {
        SortInput sort = SortInput.builder().field("eventTimestamp").direction(SortDirection.ASC).build();

        service.queryLogs(rangeFilter(), page(), null, sort);

        verify(pinotLogRepository).findLogs(eq("t1"), any(), any(), eq(FROM), eq(TO),
                any(), any(), any(), any(), any(), any(), anyInt(), eq("eventTimestamp"), eq("ASC"));
    }

    @Test
    @DisplayName("a search term routes to searchLogs, still carrying range and direction")
    void searchTermRoutesToSearchLogs() {
        SortInput sort = SortInput.builder().field("eventTimestamp").direction(SortDirection.DESC).build();

        service.queryLogs(rangeFilter(), page(), "term", sort);

        verify(pinotLogRepository).searchLogs(eq("t1"), any(), any(), eq(FROM), eq(TO),
                any(), any(), any(), any(), any(), eq("term"), any(), anyInt(), eq("eventTimestamp"), eq("DESC"));
    }

    @ParameterizedTest
    @CsvSource({
            "3, 2, 2, true",
            "2, 2, 2, false",
            "1, 2, 1, false",
            "0, 2, 0, false"
    })
    void queryLogs_rowsReturnedAgainstLimit_pageTrimmedAndNextPageFlagged(
            int returned, int limit, int expectedItems, boolean expectedHasNextPage) {
        when(pinotLogRepository.findLogs(eq("t1"), any(), any(), any(), any(), any(), any(), any(),
                any(), any(), isNull(), eq(limit + 1), eq("eventTimestamp"), eq("DESC"))).thenReturn(logs(returned));

        GenericQueryResult<LogEvent> result = service.queryLogs(LogFilterCriteria.builder().build(),
                CursorPaginationCriteria.builder().limit(limit).build(), null, null);

        assertThat(result.getItems()).hasSize(expectedItems);
        assertThat(result.getPageInfo().isHasNextPage()).isEqualTo(expectedHasNextPage);
    }

    @ParameterizedTest
    @CsvSource({
            "3, 2, 2, true",
            "2, 2, 2, false",
            "1, 2, 1, false",
            "0, 2, 0, false"
    })
    void queryLogs_searchRowsReturnedAgainstLimit_pageTrimmedAndNextPageFlagged(
            int returned, int limit, int expectedItems, boolean expectedHasNextPage) {
        when(pinotLogRepository.searchLogs(eq("t1"), any(), any(), any(), any(), any(), any(), any(),
                any(), any(), eq("term"), isNull(), eq(limit + 1), eq("eventTimestamp"), eq("DESC")))
                .thenReturn(logs(returned));

        GenericQueryResult<LogEvent> result = service.queryLogs(LogFilterCriteria.builder().build(),
                CursorPaginationCriteria.builder().limit(limit).build(), "term", null);

        assertThat(result.getItems()).hasSize(expectedItems);
        assertThat(result.getPageInfo().isHasNextPage()).isEqualTo(expectedHasNextPage);
    }

    @Test
    void queryLogs_moreRowsThanLimit_endCursorIsLastShownRowNotProbeRow() {
        when(pinotLogRepository.findLogs(eq("t1"), any(), any(), any(), any(), any(), any(), any(),
                any(), any(), isNull(), eq(3), eq("eventTimestamp"), eq("DESC"))).thenReturn(logs(3));

        GenericQueryResult<LogEvent> result = service.queryLogs(LogFilterCriteria.builder().build(),
                CursorPaginationCriteria.builder().limit(2).build(), null, null);

        assertThat(result.getItems()).extracting(LogEvent::getToolEventId).containsExactly("e-1", "e-2");
        assertThat(result.getPageInfo())
                .returns(CursorCodec.encode("1_e-1"), PageInfo::getStartCursor)
                .returns(CursorCodec.encode("2_e-2"), PageInfo::getEndCursor);
    }

    @Test
    void queryLogs_repositoryReturnsNull_emptyPageWithoutNextPage() {
        when(pinotLogRepository.findLogs(eq("t1"), any(), any(), any(), any(), any(), any(), any(),
                any(), any(), isNull(), eq(3), eq("eventTimestamp"), eq("DESC"))).thenReturn(null);

        GenericQueryResult<LogEvent> result = service.queryLogs(LogFilterCriteria.builder().build(),
                CursorPaginationCriteria.builder().limit(2).build(), null, null);

        assertThat(result.getItems()).isEmpty();
        assertThat(result.getPageInfo())
                .returns(false, PageInfo::isHasNextPage)
                .returns(null, PageInfo::getStartCursor)
                .returns(null, PageInfo::getEndCursor);
    }

    private static List<LogProjection> logs(int count) {
        return IntStream.rangeClosed(1, count)
                .mapToObj(i -> LogProjection.builder().toolEventId("e-" + i).eventTimestamp(Instant.ofEpochMilli(i)).build())
                .toList();
    }
}
