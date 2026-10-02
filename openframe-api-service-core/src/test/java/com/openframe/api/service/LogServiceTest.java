package com.openframe.api.service;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.audit.LogEvent;
import com.openframe.api.dto.audit.LogFilterCriteria;
import com.openframe.api.dto.audit.LogFilters;
import com.openframe.api.dto.audit.OrganizationFilterOption;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.data.loki.toolevent.ToolEventLogRepository;
import com.openframe.data.pinot.model.LogProjection;
import com.openframe.data.pinot.model.OrganizationOption;
import com.openframe.data.pinot.repository.PinotLogRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.time.Instant;
import java.time.LocalDate;
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
        ToolEventLogRepository toolEventLogRepository = mock(ToolEventLogRepository.class);
        TenantIdProvider tenantIdProvider = mock(TenantIdProvider.class);

        service = new LogService(pinotLogRepository, toolEventLogRepository, tenantIdProvider);

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

    @Test
    void queryLogs_everyFilterField_passesEachToPinotForTheCallersTenant() {
        LogFilterCriteria filter = LogFilterCriteria.builder()
                .startDate(LocalDate.of(2026, 9, 1))
                .endDate(LocalDate.of(2026, 9, 30))
                .timestampFrom(FROM)
                .timestampTo(TO)
                .toolTypes(List.of("FLEET"))
                .eventTypes(List.of("LOGIN"))
                .severities(List.of("WARNING"))
                .organizationIds(List.of("org-7"))
                .deviceId("device-7")
                .build();

        service.queryLogs(filter, CursorPaginationCriteria.builder().limit(5).cursor("9_e-9").build(), null, null);

        verify(pinotLogRepository).findLogs("t1", LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30), FROM, TO,
                List.of("FLEET"), List.of("LOGIN"), List.of("WARNING"), List.of("org-7"), "device-7", "9_e-9", 6,
                "eventTimestamp", "DESC");
    }

    @Test
    void queryLogs_blankSearchTerm_usesExactFiltering() {
        service.queryLogs(LogFilterCriteria.builder().build(), page(), "  ", null);

        verify(pinotLogRepository).findLogs("t1", null, null, null, null, null, null, null, null, null, null, 21,
                "eventTimestamp", "DESC");
    }

    @Test
    void queryLogs_sortFieldWithSpacesAround_sortsByTheTrimmedField() {
        SortInput sort = SortInput.builder().field(" severity ").direction(SortDirection.ASC).build();

        service.queryLogs(LogFilterCriteria.builder().build(), page(), null, sort);

        verify(pinotLogRepository).findLogs("t1", null, null, null, null, null, null, null, null, null, null, 21,
                "severity", "ASC");
    }

    @Test
    void queryLogs_sortFieldNotSortable_sortsByTheDefaultField() {
        when(pinotLogRepository.isSortableField("details")).thenReturn(false);
        SortInput sort = SortInput.builder().field("details").direction(SortDirection.ASC).build();

        service.queryLogs(LogFilterCriteria.builder().build(), page(), null, sort);

        verify(pinotLogRepository).findLogs("t1", null, null, null, null, null, null, null, null, null, null, 21,
                "eventTimestamp", "ASC");
    }

    @Test
    void queryLogs_blankSortField_sortsByTheDefaultField() {
        SortInput sort = SortInput.builder().field("  ").direction(SortDirection.ASC).build();

        service.queryLogs(LogFilterCriteria.builder().build(), page(), null, sort);

        verify(pinotLogRepository).findLogs("t1", null, null, null, null, null, null, null, null, null, null, 21,
                "eventTimestamp", "ASC");
    }

    @Test
    void queryLogs_sortWithoutDirection_sortsDescending() {
        SortInput sort = SortInput.builder().field("severity").build();

        service.queryLogs(LogFilterCriteria.builder().build(), page(), null, sort);

        verify(pinotLogRepository).findLogs("t1", null, null, null, null, null, null, null, null, null, null, 21,
                "severity", "DESC");
    }

    @ParameterizedTest
    @CsvSource(value = {"9_e-9, true", "null, false"}, nullValues = "null")
    void queryLogs_cursorGivenOrNot_reportsAPreviousPageOnlyWithACursor(String cursor, boolean expectedHasPreviousPage) {
        GenericQueryResult<LogEvent> result = service.queryLogs(LogFilterCriteria.builder().build(),
                CursorPaginationCriteria.builder().limit(2).cursor(cursor).build(), null, null);

        assertThat(result.getPageInfo().isHasPreviousPage()).isEqualTo(expectedHasPreviousPage);
    }

    @Test
    void queryLogs_rowFromPinot_mapsEveryField() {
        when(pinotLogRepository.findLogs("t1", null, null, null, null, null, null, null, null, null, null, 21,
                "eventTimestamp", "DESC")).thenReturn(List.of(LogProjection.builder()
                .toolEventId("evt-1")
                .ingestDay("2026-10-01")
                .toolType("FLEET")
                .eventType("LOGIN")
                .severity("WARNING")
                .userId("user-7")
                .deviceId("device-7")
                .hostname("host-7")
                .nickname("Reception iMac")
                .executionSource("MANUAL")
                .scriptCreationSource("AI_ASSISTANT")
                .organizationId("org-7")
                .organizationName("Acme")
                .summary("User logged in")
                .eventTimestamp(Instant.ofEpochMilli(1_790_848_800_123L))
                .build()));

        GenericQueryResult<LogEvent> result = service.queryLogs(LogFilterCriteria.builder().build(), page(), null, null);

        assertThat(result.getItems()).containsExactly(LogEvent.builder()
                .id("1790848800123_evt-1")
                .toolEventId("evt-1")
                .ingestDay("2026-10-01")
                .toolType("FLEET")
                .eventType("LOGIN")
                .severity("WARNING")
                .userId("user-7")
                .deviceId("device-7")
                .hostname("host-7")
                .nickname("Reception iMac")
                .executionSource("MANUAL")
                .scriptCreationSource("AI_ASSISTANT")
                .organizationId("org-7")
                .organizationName("Acme")
                .summary("User logged in")
                .timestamp(Instant.ofEpochMilli(1_790_848_800_123L))
                .build());
    }

    @Test
    void getLogFilters_criteria_returnsTheOptionsOfTheCallersTenant() {
        LocalDate start = LocalDate.of(2026, 9, 1);
        LocalDate end = LocalDate.of(2026, 9, 30);
        List<String> tools = List.of("FLEET");
        List<String> events = List.of("LOGIN");
        List<String> severities = List.of("WARNING");
        List<String> organizations = List.of("org-7");
        when(pinotLogRepository.getToolTypeOptions("t1", start, end, tools, events, severities, organizations))
                .thenReturn(List.of("FLEET", "RMM"));
        when(pinotLogRepository.getEventTypeOptions("t1", start, end, tools, events, severities, organizations))
                .thenReturn(List.of("LOGIN", "LOGOUT"));
        when(pinotLogRepository.getSeverityOptions("t1", start, end, tools, events, severities, organizations))
                .thenReturn(List.of("INFO", "WARNING"));
        when(pinotLogRepository.getOrganizationOptions("t1", start, end, tools, events, severities))
                .thenReturn(List.of(new OrganizationOption("org-7", "Acme")));

        LogFilters filters = service.getLogFilters(LogFilterCriteria.builder()
                .startDate(start)
                .endDate(end)
                .toolTypes(tools)
                .eventTypes(events)
                .severities(severities)
                .organizationIds(organizations)
                .build());

        assertThat(filters).isEqualTo(LogFilters.builder()
                .toolTypes(List.of("FLEET", "RMM"))
                .eventTypes(List.of("LOGIN", "LOGOUT"))
                .severities(List.of("INFO", "WARNING"))
                .organizations(List.of(new OrganizationFilterOption("org-7", "Acme")))
                .build());
    }

    private static List<LogProjection> logs(int count) {
        return IntStream.rangeClosed(1, count)
                .mapToObj(i -> LogProjection.builder().toolEventId("e-" + i).eventTimestamp(Instant.ofEpochMilli(i)).build())
                .toList();
    }
}
