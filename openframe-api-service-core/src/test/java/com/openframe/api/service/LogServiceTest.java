package com.openframe.api.service;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.audit.LogEvent;
import com.openframe.api.dto.audit.LogFilterCriteria;
import com.openframe.api.dto.audit.LogFilters;
import com.openframe.api.dto.audit.OrganizationFilterOption;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.core.exception.InvalidCursorException;
import com.openframe.data.pinot.model.LogProjection;
import com.openframe.data.pinot.model.LogSortPosition;
import com.openframe.data.pinot.model.OrganizationOption;
import com.openframe.data.pinot.repository.PinotClientLogRepository;
import com.openframe.data.pinot.repository.PinotLogRepository;
import com.openframe.data.repository.cursor.CursorBase64;
import com.openframe.data.repository.cursor.KeysetCursor;
import com.openframe.data.service.TenantIdProvider;
import org.apache.pinot.client.Connection;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.data.domain.Sort;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.function.Function;
import java.util.stream.IntStream;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
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
    private static final String EVENT_TIMESTAMP = "eventTimestamp";
    private static final String SEVERITY = "severity";
    private static final String SEARCH = "term";
    private static final String KEYSET_PREFIX = "k1|";
    private static final String INVALID_CURSOR = "Invalid cursor";
    private static final List<LogProjection> ROWS = List.of(
            row("e-1", 1000, "ERROR", "LOGIN", "FLEET", "", "dev-1", "2026-10-01"),
            row("e-2", 1000, "ERROR", "LOGIN", "FLEET", "", "dev-1", "2026-10-01"),
            row("e-3", 2000, "INFO", "LOGOUT", "FLEET", "org-1", "dev-2", "2026-10-01"),
            row("e-4", 2000, "INFO", "LOGOUT", "RMM", "org-1", "dev-2", "2026-10-02"),
            row("e-5", 3000, "WARNING", "SCRIPT", "RMM", "org-2", "dev-3", "2026-10-02"));

    private final PinotLogRepository positionIssuer = new PinotClientLogRepository(mock(Connection.class));

    private PinotLogRepository pinotLogRepository;
    private LogService service;

    @BeforeEach
    void setUp() {
        pinotLogRepository = mock(PinotLogRepository.class);
        TenantIdProvider tenantIdProvider = mock(TenantIdProvider.class);

        service = new LogService(pinotLogRepository, tenantIdProvider);

        when(tenantIdProvider.getTenantId()).thenReturn("t1");
        when(pinotLogRepository.isSortableField(any())).thenReturn(true);
        when(pinotLogRepository.getDefaultSortField()).thenReturn("eventTimestamp");
        when(pinotLogRepository.findLogs(any(), any(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), anyInt(), any(), any(), anyBoolean())).thenReturn(List.of());
        when(pinotLogRepository.searchLogs(any(), any(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any(), anyInt(), any(), any(), anyBoolean())).thenReturn(List.of());
        when(pinotLogRepository.sortPositionOf(any(LogProjection.class), any()))
                .thenAnswer(call -> positionIssuer.sortPositionOf(call.getArgument(0), call.getArgument(1)));
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
                any(), any(), any(), any(), any(), any(), anyInt(), eq("eventTimestamp"), eq("ASC"), eq(false));
    }

    @Test
    @DisplayName("a search term routes to searchLogs, still carrying range and direction")
    void searchTermRoutesToSearchLogs() {
        SortInput sort = SortInput.builder().field("eventTimestamp").direction(SortDirection.DESC).build();

        service.queryLogs(rangeFilter(), page(), "term", sort);

        verify(pinotLogRepository).searchLogs(eq("t1"), any(), any(), eq(FROM), eq(TO),
                any(), any(), any(), any(), any(), eq("term"), any(), anyInt(), eq("eventTimestamp"), eq("DESC"), eq(false));
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
                any(), any(), isNull(), eq(limit + 1), eq("eventTimestamp"), eq("DESC"), eq(false))).thenReturn(logs(returned));

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
                any(), any(), eq("term"), isNull(), eq(limit + 1), eq("eventTimestamp"), eq("DESC"), eq(false)))
                .thenReturn(logs(returned));

        GenericQueryResult<LogEvent> result = service.queryLogs(LogFilterCriteria.builder().build(),
                CursorPaginationCriteria.builder().limit(limit).build(), "term", null);

        assertThat(result.getItems()).hasSize(expectedItems);
        assertThat(result.getPageInfo().isHasNextPage()).isEqualTo(expectedHasNextPage);
    }

    @Test
    void queryLogs_moreRowsThanLimit_endCursorIsLastShownRowNotProbeRow() {
        when(pinotLogRepository.findLogs(eq("t1"), any(), any(), any(), any(), any(), any(), any(),
                any(), any(), isNull(), eq(3), eq("eventTimestamp"), eq("DESC"), eq(false))).thenReturn(logs(3));

        GenericQueryResult<LogEvent> result = service.queryLogs(LogFilterCriteria.builder().build(),
                CursorPaginationCriteria.builder().limit(2).build(), null, null);

        assertThat(result.getItems()).extracting(LogEvent::getToolEventId).containsExactly("e-1", "e-2");
        assertThat(result.getPageInfo())
                .returns(CursorCodec.encode("k1|eventTimestamp|DESC|1|e-1"), PageInfo::getStartCursor)
                .returns(CursorCodec.encode("k1|eventTimestamp|DESC|2|e-2"), PageInfo::getEndCursor);
    }

    @Test
    void queryLogs_repositoryReturnsNull_emptyPageWithoutNextPage() {
        when(pinotLogRepository.findLogs(eq("t1"), any(), any(), any(), any(), any(), any(), any(),
                any(), any(), isNull(), eq(3), eq("eventTimestamp"), eq("DESC"), eq(false))).thenReturn(null);

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
        service.queryLogs(everyFilterField(), CursorPaginationCriteria.builder().limit(5).cursor("9_e-9").build(),
                null, null);

        verify(pinotLogRepository).findLogs("t1", LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30), FROM, TO,
                List.of("FLEET"), List.of("LOGIN"), List.of("WARNING"), List.of("org-7"), "device-7",
                LogSortPosition.ofTimestamp(9, "e-9"), 6,
                "eventTimestamp", "DESC", false);
    }

    @Test
    void queryLogs_searchTermAndEveryFilterField_passesEachToPinotSearchForTheCallersTenant() {
        service.queryLogs(everyFilterField(), CursorPaginationCriteria.builder().limit(5).cursor("9_e-9").build(),
                "term", null);

        verify(pinotLogRepository).searchLogs("t1", LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30), FROM, TO,
                List.of("FLEET"), List.of("LOGIN"), List.of("WARNING"), List.of("org-7"), "device-7", "term",
                LogSortPosition.ofTimestamp(9, "e-9"), 6, "eventTimestamp", "DESC", false);
    }

    @Test
    void queryLogs_noLimit_asksPinotForTheDefaultPageAndOneProbeRow() {
        service.queryLogs(LogFilterCriteria.builder().build(), CursorPaginationCriteria.builder().build(), null, null);

        verify(pinotLogRepository).findLogs("t1", null, null, null, null, null, null, null, null, null, null, 21,
                "eventTimestamp", "DESC", false);
    }

    @Test
    void queryLogs_blankSearchTerm_usesExactFiltering() {
        service.queryLogs(LogFilterCriteria.builder().build(), page(), "  ", null);

        verify(pinotLogRepository).findLogs("t1", null, null, null, null, null, null, null, null, null, null, 21,
                "eventTimestamp", "DESC", false);
    }

    @Test
    void queryLogs_sortFieldWithSpacesAround_sortsByTheTrimmedField() {
        SortInput sort = SortInput.builder().field(" severity ").direction(SortDirection.ASC).build();

        service.queryLogs(LogFilterCriteria.builder().build(), page(), null, sort);

        verify(pinotLogRepository).isSortableField("severity");
        verify(pinotLogRepository).findLogs("t1", null, null, null, null, null, null, null, null, null, null, 21,
                "severity", "ASC", false);
    }

    @Test
    void queryLogs_sortFieldNotSortable_sortsByTheDefaultField() {
        when(pinotLogRepository.isSortableField("details")).thenReturn(false);
        SortInput sort = SortInput.builder().field("details").direction(SortDirection.ASC).build();

        service.queryLogs(LogFilterCriteria.builder().build(), page(), null, sort);

        verify(pinotLogRepository).findLogs("t1", null, null, null, null, null, null, null, null, null, null, 21,
                "eventTimestamp", "ASC", false);
    }

    @Test
    void queryLogs_blankSortField_sortsByTheDefaultField() {
        SortInput sort = SortInput.builder().field("  ").direction(SortDirection.ASC).build();

        service.queryLogs(LogFilterCriteria.builder().build(), page(), null, sort);

        verify(pinotLogRepository).findLogs("t1", null, null, null, null, null, null, null, null, null, null, 21,
                "eventTimestamp", "ASC", false);
    }

    @Test
    void queryLogs_sortWithoutDirection_sortsDescending() {
        SortInput sort = SortInput.builder().field("severity").build();

        service.queryLogs(LogFilterCriteria.builder().build(), page(), null, sort);

        verify(pinotLogRepository).findLogs("t1", null, null, null, null, null, null, null, null, null, null, 21,
                "severity", "DESC", false);
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
                "eventTimestamp", "DESC", false)).thenReturn(List.of(LogProjection.builder()
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

    @ParameterizedTest
    @MethodSource("logSorts")
    void queryLogs_pageOneThenPageTwoThenBeforePageTwo_returnsPageOneAgain(
            String sortField, SortDirection direction, List<String> pageOneRows, List<String> pageTwoRows) {
        // setup
        stubLogPages();
        SortInput sort = SortInput.builder().field(sortField).direction(direction).build();

        // execution
        GenericQueryResult<LogEvent> pageOne = service.queryLogs(noFilter(), forward(2, null), null, sort);
        GenericQueryResult<LogEvent> pageTwo =
                service.queryLogs(noFilter(), forward(2, pageOne.getPageInfo().getEndCursor()), null, sort);
        GenericQueryResult<LogEvent> backToPageOne =
                service.queryLogs(noFilter(), backward(2, pageTwo.getPageInfo().getStartCursor()), null, sort);

        // verifications
        assertThat(pageOne.getItems()).extracting(LogEvent::getToolEventId).containsExactlyElementsOf(pageOneRows);
        assertThat(pageTwo.getItems()).extracting(LogEvent::getToolEventId).containsExactlyElementsOf(pageTwoRows);
        assertThat(backToPageOne.getItems()).extracting(LogEvent::getToolEventId).containsExactlyElementsOf(pageOneRows);
        assertThat(backToPageOne.getPageInfo())
                .returns(pageOne.getPageInfo().getStartCursor(), PageInfo::getStartCursor)
                .returns(pageOne.getPageInfo().getEndCursor(), PageInfo::getEndCursor)
                .returns(false, PageInfo::isHasPreviousPage)
                .returns(true, PageInfo::isHasNextPage);
    }

    @ParameterizedTest
    @MethodSource("logSorts")
    void queryLogs_searchPageOneThenPageTwoThenBeforePageTwo_returnsPageOneAgain(
            String sortField, SortDirection direction, List<String> pageOneRows, List<String> pageTwoRows) {
        // setup
        stubLogPages();
        SortInput sort = SortInput.builder().field(sortField).direction(direction).build();

        // execution
        GenericQueryResult<LogEvent> pageOne = service.queryLogs(noFilter(), forward(2, null), SEARCH, sort);
        GenericQueryResult<LogEvent> pageTwo =
                service.queryLogs(noFilter(), forward(2, pageOne.getPageInfo().getEndCursor()), SEARCH, sort);
        GenericQueryResult<LogEvent> backToPageOne =
                service.queryLogs(noFilter(), backward(2, pageTwo.getPageInfo().getStartCursor()), SEARCH, sort);

        // verifications
        assertThat(pageOne.getItems()).extracting(LogEvent::getToolEventId).containsExactlyElementsOf(pageOneRows);
        assertThat(pageTwo.getItems()).extracting(LogEvent::getToolEventId).containsExactlyElementsOf(pageTwoRows);
        assertThat(backToPageOne.getItems()).extracting(LogEvent::getToolEventId).containsExactlyElementsOf(pageOneRows);
        assertThat(backToPageOne.getPageInfo())
                .returns(pageOne.getPageInfo().getStartCursor(), PageInfo::getStartCursor)
                .returns(pageOne.getPageInfo().getEndCursor(), PageInfo::getEndCursor);
    }

    @ParameterizedTest
    @MethodSource("pagesOfFiveRows")
    void queryLogs_eachPageInEachDirection_rowsInDisplayOrderWithBothFlags(
            SortInput sort, boolean backward, String cursor, List<String> expectedRows,
            boolean hasPreviousPage, boolean hasNextPage) {
        // setup
        stubLogPages();
        CursorPaginationCriteria pagination = connectionPage(backward, 2, cursor);

        // execution
        GenericQueryResult<LogEvent> result = service.queryLogs(noFilter(), pagination, null, sort);

        // verifications
        assertThat(result.getItems()).extracting(LogEvent::getToolEventId).containsExactlyElementsOf(expectedRows);
        assertThat(result.getPageInfo())
                .returns(hasPreviousPage, PageInfo::isHasPreviousPage)
                .returns(hasNextPage, PageInfo::isHasNextPage);
    }

    @Test
    void queryLogs_lastWithoutBefore_lastRowsInDisplayOrderAndNoNextPage() {
        // setup
        stubLogPages();
        SortInput sort = SortInput.builder().field(SEVERITY).direction(SortDirection.ASC).build();

        // execution
        GenericQueryResult<LogEvent> result = service.queryLogs(noFilter(), backward(2, null), null, sort);

        // verifications
        assertThat(result.getItems()).extracting(LogEvent::getToolEventId).containsExactly("e-4", "e-5");
        assertThat(result.getPageInfo())
                .returns(false, PageInfo::isHasNextPage)
                .returns(true, PageInfo::isHasPreviousPage);
        verify(pinotLogRepository).findLogs("t1", null, null, null, null, null, null, null, null, null, null, 3,
                SEVERITY, "ASC", true);
    }

    @Test
    void queryLogs_lastLargerThanTheList_everyRowInDisplayOrderAndNoPageOnEitherSide() {
        // setup
        stubLogPages();

        // execution
        GenericQueryResult<LogEvent> result = service.queryLogs(noFilter(), backward(10, null), null, null);

        // verifications
        assertThat(result.getItems()).extracting(LogEvent::getToolEventId)
                .containsExactly("e-5", "e-4", "e-3", "e-2", "e-1");
        assertThat(result.getPageInfo())
                .returns(false, PageInfo::isHasNextPage)
                .returns(false, PageInfo::isHasPreviousPage);
    }

    @Test
    void queryLogs_backwardPageWithNoRows_noCursorsAndNextPageOnlyWhenACursorWasSent() {
        // setup
        KeysetCursor beforeTheFirstRow =
                KeysetCursor.ofInstant(EVENT_TIMESTAMP, Sort.Direction.DESC, Instant.ofEpochMilli(9000), "e-9");

        // execution
        GenericQueryResult<LogEvent> result =
                service.queryLogs(noFilter(), backward(2, beforeTheFirstRow.encode()), null, null);

        // verifications
        assertThat(result.getItems()).isEmpty();
        assertThat(result.getPageInfo())
                .returns(true, PageInfo::isHasNextPage)
                .returns(false, PageInfo::isHasPreviousPage)
                .returns(null, PageInfo::getStartCursor)
                .returns(null, PageInfo::getEndCursor);
    }

    @ParameterizedTest
    @MethodSource("keysetsOfTheFirstTwoRows")
    void queryLogs_pageInfoCursors_keysetCursorsOfTheFirstAndLastShownRows(
            String sortField, SortDirection direction, KeysetCursor expectedStart, KeysetCursor expectedEnd) {
        // setup
        stubLogPages();
        SortInput sort = SortInput.builder().field(sortField).direction(direction).build();

        // execution
        PageInfo pageInfo = service.queryLogs(noFilter(), forward(2, null), null, sort).getPageInfo();

        // verifications
        assertThat(KeysetCursor.parse(pageInfo.getStartCursor())).isEqualTo(expectedStart);
        assertThat(KeysetCursor.parse(pageInfo.getEndCursor())).isEqualTo(expectedEnd);
        assertThat(CursorBase64.decode(pageInfo.getStartCursor())).startsWith(KEYSET_PREFIX);
        assertThat(CursorBase64.decode(pageInfo.getEndCursor())).startsWith(KEYSET_PREFIX);
    }

    @Test
    void queryLogs_defaultSort_pageInfoCursorIsTheKeysetTextOfTheTimeSortEncodedOnce() {
        // setup
        stubLogPages();

        // execution
        PageInfo pageInfo = service.queryLogs(noFilter(), forward(2, null), null, null).getPageInfo();

        // verifications
        assertThat(CursorCodec.decode(pageInfo.getStartCursor())).isEqualTo("k1|eventTimestamp|DESC|3000|e-5");
        assertThat(CursorCodec.decode(pageInfo.getEndCursor())).isEqualTo("k1|eventTimestamp|DESC|2000|e-4");
    }

    @Test
    void queryLogs_pageInfoCursorDecodedOnceAsARestClientSendsIt_returnsTheNextPage() {
        // setup
        stubLogPages();
        SortInput sort = SortInput.builder().field(SEVERITY).direction(SortDirection.ASC).build();
        GenericQueryResult<LogEvent> pageOne = service.queryLogs(noFilter(), page(2, null), null, sort);
        String decodedOnce = CursorCodec.decode(pageOne.getPageInfo().getEndCursor());

        // execution
        GenericQueryResult<LogEvent> pageTwo = service.queryLogs(noFilter(), page(2, decodedOnce), null, sort);

        // verifications
        assertThat(decodedOnce).isEqualTo("k1|severity|ASC|RVJST1I=|e-2");
        assertThat(pageTwo.getItems()).extracting(LogEvent::getToolEventId).containsExactly("e-3", "e-4");
        assertThat(pageTwo.getPageInfo())
                .returns(true, PageInfo::isHasPreviousPage)
                .returns(true, PageInfo::isHasNextPage);
    }

    @Test
    void queryLogs_keysetCursorOfATextSortBackward_pinotGetsTheTextPositionAndTheDirection() {
        // setup
        SortInput sort = SortInput.builder().field(SEVERITY).direction(SortDirection.ASC).build();
        KeysetCursor cursor = KeysetCursor.ofString(SEVERITY, Sort.Direction.ASC, "INFO", "e-3");

        // execution
        service.queryLogs(noFilter(), backward(2, cursor.encode()), null, sort);

        // verifications
        verify(pinotLogRepository).findLogs("t1", null, null, null, null, null, null, null, null, null,
                LogSortPosition.ofText("INFO", "e-3"), 3, SEVERITY, "ASC", true);
    }

    @Test
    void queryLogs_keysetCursorOfTheTimeSort_pinotGetsTheTimestampPosition() {
        // setup
        SortInput sort = SortInput.builder().field(EVENT_TIMESTAMP).direction(SortDirection.ASC).build();
        KeysetCursor cursor = KeysetCursor.ofInstant(EVENT_TIMESTAMP, Sort.Direction.ASC, Instant.ofEpochMilli(2000), "e-3");

        // execution
        service.queryLogs(noFilter(), forward(2, cursor.encode()), null, sort);

        // verifications
        verify(pinotLogRepository).findLogs("t1", null, null, null, null, null, null, null, null, null,
                LogSortPosition.ofTimestamp(2000, "e-3"), 3, EVENT_TIMESTAMP, "ASC", false);
    }

    @Test
    void queryLogs_keysetCursorWithAnEmptyTextValue_pinotGetsTheEmptyStringPosition() {
        // setup
        SortInput sort = SortInput.builder().field("organizationId").direction(SortDirection.ASC).build();
        KeysetCursor cursor = KeysetCursor.ofString("organizationId", Sort.Direction.ASC, "", "e-2");

        // execution
        service.queryLogs(noFilter(), forward(2, cursor.encode()), null, sort);

        // verifications
        verify(pinotLogRepository).findLogs("t1", null, null, null, null, null, null, null, null, null,
                LogSortPosition.ofText("", "e-2"), 3, "organizationId", "ASC", false);
    }

    @Test
    void queryLogs_keysetCursorWithSearchTermBackward_pinotSearchGetsThePositionAndTheDirection() {
        // setup
        SortInput sort = SortInput.builder().field(SEVERITY).direction(SortDirection.DESC).build();
        KeysetCursor cursor = KeysetCursor.ofString(SEVERITY, Sort.Direction.DESC, "INFO", "e-3");

        // execution
        service.queryLogs(noFilter(), backward(2, cursor.encode()), SEARCH, sort);

        // verifications
        verify(pinotLogRepository).searchLogs("t1", null, null, null, null, null, null, null, null, null, SEARCH,
                LogSortPosition.ofText("INFO", "e-3"), 3, SEVERITY, "DESC", true);
    }

    @Test
    void queryLogs_keysetOfARowThatIsGone_pageStillStartsAtThatPosition() {
        // setup
        stubLogPages();
        SortInput sort = SortInput.builder().field(SEVERITY).direction(SortDirection.ASC).build();
        KeysetCursor goneRow = KeysetCursor.ofString(SEVERITY, Sort.Direction.ASC, "FATAL", "e-0");

        // execution
        GenericQueryResult<LogEvent> after = service.queryLogs(noFilter(), forward(2, goneRow.encode()), null, sort);
        GenericQueryResult<LogEvent> before = service.queryLogs(noFilter(), backward(2, goneRow.encode()), null, sort);

        // verifications
        assertThat(after.getItems()).extracting(LogEvent::getToolEventId).containsExactly("e-3", "e-4");
        assertThat(before.getItems()).extracting(LogEvent::getToolEventId).containsExactly("e-1", "e-2");
    }

    @ParameterizedTest
    @CsvSource({"ASC, false", "DESC, false", "ASC, true", "DESC, true"})
    void queryLogs_olderCursorUnderTheTimeSort_acceptedAsATimestampPosition(SortDirection direction, boolean backward) {
        // setup
        SortInput sort = SortInput.builder().field(EVENT_TIMESTAMP).direction(direction).build();
        CursorPaginationCriteria pagination =
                CursorPaginationCriteria.builder().limit(2).cursor("2000_e-3").backward(backward).build();

        // execution
        service.queryLogs(noFilter(), pagination, null, sort);

        // verifications
        verify(pinotLogRepository).findLogs("t1", null, null, null, null, null, null, null, null, null,
                LogSortPosition.ofTimestamp(2000, "e-3"), 3, EVENT_TIMESTAMP, direction.name(), backward);
    }

    @Test
    void queryLogs_olderCursorWhoseIdHasUnderscores_idIsEverythingAfterTheFirstUnderscore() {
        // execution
        service.queryLogs(noFilter(), page(2, "2000_Directory_a1_b2"), null, null);

        // verifications
        verify(pinotLogRepository).findLogs("t1", null, null, null, null, null, null, null, null, null,
                LogSortPosition.ofTimestamp(2000, "Directory_a1_b2"), 3, EVENT_TIMESTAMP, "DESC", false);
    }

    @Test
    void queryLogs_olderCursorOverThePages_continuesFromThatPosition() {
        // setup
        stubLogPages();

        // execution
        GenericQueryResult<LogEvent> result = service.queryLogs(noFilter(), page(2, "2000_e-4"), null, null);

        // verifications
        assertThat(result.getItems()).extracting(LogEvent::getToolEventId).containsExactly("e-3", "e-2");
        assertThat(result.getPageInfo())
                .returns(true, PageInfo::isHasPreviousPage)
                .returns(true, PageInfo::isHasNextPage);
        assertThat(CursorCodec.decode(result.getPageInfo().getEndCursor())).isEqualTo("k1|eventTimestamp|DESC|1000|e-2");
    }

    @ParameterizedTest
    @ValueSource(strings = {"severity", "eventType", "toolType", "organizationId", "deviceId", "ingestDay"})
    void queryLogs_olderCursorUnderAnotherSort_throwsInvalidCursorAndPinotIsNotAsked(String sortField) {
        // setup
        SortInput sort = SortInput.builder().field(sortField).direction(SortDirection.DESC).build();
        CursorPaginationCriteria pagination = page(2, "2000_e-3");

        // execution
        Throwable thrown = catchThrowable(() -> service.queryLogs(noFilter(), pagination, null, sort));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verifyPinotNotAsked();
    }

    @ParameterizedTest
    @MethodSource("keysetsOfAnotherSort")
    void queryLogs_keysetOfAnotherSortFieldOrDirection_throwsInvalidCursorAndPinotIsNotAsked(
            KeysetCursor cursor, SortInput currentSort) {
        // setup
        CursorPaginationCriteria pagination = forward(2, cursor.encode());

        // execution
        Throwable thrown = catchThrowable(() -> service.queryLogs(noFilter(), pagination, null, currentSort));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verifyPinotNotAsked();
    }

    @ParameterizedTest
    @MethodSource("textsThatAreNotALogPosition")
    void queryLogs_cursorThatIsNotALogPosition_throwsInvalidCursorAndPinotIsNotAsked(
            String decodedCursor, SortInput sort) {
        // setup
        CursorPaginationCriteria pagination = page(2, decodedCursor);

        // execution
        Throwable thrown = catchThrowable(() -> service.queryLogs(noFilter(), pagination, null, sort));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verifyPinotNotAsked();
    }

    @ParameterizedTest
    @MethodSource("textsThatAreNotALogPosition")
    void queryLogs_searchWithACursorThatIsNotALogPosition_throwsInvalidCursorAndPinotIsNotAsked(
            String decodedCursor, SortInput sort) {
        // setup
        CursorPaginationCriteria pagination =
                CursorPaginationCriteria.builder().limit(2).cursor(decodedCursor).backward(true).build();

        // execution
        Throwable thrown = catchThrowable(() -> service.queryLogs(noFilter(), pagination, SEARCH, sort));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verifyPinotNotAsked();
    }

    @Test
    void queryLogs_cursorNamesAFieldThatIsNotSortable_throwsInvalidCursorAndPinotIsNotAsked() {
        // setup
        String notAColumn = "severity; DROP TABLE logs";
        when(pinotLogRepository.isSortableField(notAColumn)).thenReturn(false);
        SortInput sort = SortInput.builder().field(notAColumn).direction(SortDirection.ASC).build();
        KeysetCursor cursor = KeysetCursor.ofString(notAColumn, Sort.Direction.ASC, "INFO", "e-3");
        CursorPaginationCriteria pagination = forward(2, cursor.encode());

        // execution
        Throwable thrown = catchThrowable(() -> service.queryLogs(noFilter(), pagination, null, sort));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verifyPinotNotAsked();
    }

    @ParameterizedTest
    @ValueSource(strings = {"O'Brien", "a\\b", "x'; DROP TABLE logs;--", "\\'; DROP TABLE logs;--",
            "x') OR (tenantId != 't1"})
    void queryLogs_keysetValueAndIdWithSqlMetacharacters_pinotGetsThemAsPlainValuesUnderTheRequestedSort(String payload) {
        // setup
        SortInput sort = SortInput.builder().field(SEVERITY).direction(SortDirection.ASC).build();
        KeysetCursor cursor = KeysetCursor.ofString(SEVERITY, Sort.Direction.ASC, payload, payload);

        // execution
        service.queryLogs(noFilter(), forward(2, cursor.encode()), null, sort);

        // verifications
        verify(pinotLogRepository).findLogs("t1", null, null, null, null, null, null, null, null, null,
                LogSortPosition.ofText(payload, payload), 3, SEVERITY, "ASC", false);
    }

    @ParameterizedTest
    @ValueSource(strings = {"O'Brien", "a\\b", "x'; DROP TABLE logs;--", "x') OR (tenantId != 't1"})
    void queryLogs_olderCursorIdWithSqlMetacharacters_pinotGetsItAsAPlainId(String payload) {
        // execution
        service.queryLogs(noFilter(), page(2, "2000_" + payload), null, null);

        // verifications
        verify(pinotLogRepository).findLogs("t1", null, null, null, null, null, null, null, null, null,
                LogSortPosition.ofTimestamp(2000, payload), 3, EVENT_TIMESTAMP, "DESC", false);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "  "})
    void queryLogs_blankCursor_firstPageWithoutAPosition(String cursor) {
        // execution
        GenericQueryResult<LogEvent> result = service.queryLogs(noFilter(), page(2, cursor), null, null);

        // verifications
        assertThat(result.getPageInfo().isHasPreviousPage()).isFalse();
        verify(pinotLogRepository).findLogs("t1", null, null, null, null, null, null, null, null, null, null, 3,
                EVENT_TIMESTAMP, "DESC", false);
    }

    private static Stream<Arguments> logSorts() {
        return Stream.of(EVENT_TIMESTAMP, SEVERITY, "eventType", "toolType", "organizationId", "deviceId", "ingestDay")
                .flatMap(sortField -> Stream.of(
                        arguments(sortField, SortDirection.ASC, List.of("e-1", "e-2"), List.of("e-3", "e-4")),
                        arguments(sortField, SortDirection.DESC, List.of("e-5", "e-4"), List.of("e-3", "e-2"))));
    }

    private static Stream<Arguments> pagesOfFiveRows() {
        SortInput bySeverity = SortInput.builder().field(SEVERITY).direction(SortDirection.ASC).build();
        SortInput newestFirst = SortInput.builder().field(EVENT_TIMESTAMP).direction(SortDirection.DESC).build();
        return Stream.of(
                arguments(bySeverity, false, null, List.of("e-1", "e-2"), false, true),
                arguments(bySeverity, false, severityCursor(2), List.of("e-3", "e-4"), true, true),
                arguments(bySeverity, false, severityCursor(4), List.of("e-5"), true, false),
                arguments(bySeverity, false, severityCursor(5), List.of(), true, false),
                arguments(bySeverity, true, null, List.of("e-4", "e-5"), true, false),
                arguments(bySeverity, true, severityCursor(5), List.of("e-3", "e-4"), true, true),
                arguments(bySeverity, true, severityCursor(4), List.of("e-2", "e-3"), true, true),
                arguments(bySeverity, true, severityCursor(3), List.of("e-1", "e-2"), false, true),
                arguments(bySeverity, true, severityCursor(2), List.of("e-1"), false, true),
                arguments(bySeverity, true, severityCursor(1), List.of(), false, true),
                arguments(newestFirst, false, null, List.of("e-5", "e-4"), false, true),
                arguments(newestFirst, false, timeCursor(4), List.of("e-3", "e-2"), true, true),
                arguments(newestFirst, false, timeCursor(2), List.of("e-1"), true, false),
                arguments(newestFirst, false, timeCursor(1), List.of(), true, false),
                arguments(newestFirst, true, null, List.of("e-2", "e-1"), true, false),
                arguments(newestFirst, true, timeCursor(2), List.of("e-4", "e-3"), true, true),
                arguments(newestFirst, true, timeCursor(3), List.of("e-5", "e-4"), false, true),
                arguments(newestFirst, true, timeCursor(4), List.of("e-5"), false, true),
                arguments(newestFirst, true, timeCursor(5), List.of(), false, true));
    }

    private static Stream<Arguments> keysetsOfTheFirstTwoRows() {
        return Stream.of(
                arguments(EVENT_TIMESTAMP, SortDirection.DESC,
                        KeysetCursor.ofInstant(EVENT_TIMESTAMP, Sort.Direction.DESC, Instant.ofEpochMilli(3000), "e-5"),
                        KeysetCursor.ofInstant(EVENT_TIMESTAMP, Sort.Direction.DESC, Instant.ofEpochMilli(2000), "e-4")),
                arguments(EVENT_TIMESTAMP, SortDirection.ASC,
                        KeysetCursor.ofInstant(EVENT_TIMESTAMP, Sort.Direction.ASC, Instant.ofEpochMilli(1000), "e-1"),
                        KeysetCursor.ofInstant(EVENT_TIMESTAMP, Sort.Direction.ASC, Instant.ofEpochMilli(1000), "e-2")),
                arguments(SEVERITY, SortDirection.ASC,
                        KeysetCursor.ofString(SEVERITY, Sort.Direction.ASC, "ERROR", "e-1"),
                        KeysetCursor.ofString(SEVERITY, Sort.Direction.ASC, "ERROR", "e-2")),
                arguments("eventType", SortDirection.ASC,
                        KeysetCursor.ofString("eventType", Sort.Direction.ASC, "LOGIN", "e-1"),
                        KeysetCursor.ofString("eventType", Sort.Direction.ASC, "LOGIN", "e-2")),
                arguments("toolType", SortDirection.DESC,
                        KeysetCursor.ofString("toolType", Sort.Direction.DESC, "RMM", "e-5"),
                        KeysetCursor.ofString("toolType", Sort.Direction.DESC, "RMM", "e-4")),
                arguments("organizationId", SortDirection.ASC,
                        KeysetCursor.ofString("organizationId", Sort.Direction.ASC, "", "e-1"),
                        KeysetCursor.ofString("organizationId", Sort.Direction.ASC, "", "e-2")),
                arguments("deviceId", SortDirection.DESC,
                        KeysetCursor.ofString("deviceId", Sort.Direction.DESC, "dev-3", "e-5"),
                        KeysetCursor.ofString("deviceId", Sort.Direction.DESC, "dev-2", "e-4")),
                arguments("ingestDay", SortDirection.ASC,
                        KeysetCursor.ofString("ingestDay", Sort.Direction.ASC, "2026-10-01", "e-1"),
                        KeysetCursor.ofString("ingestDay", Sort.Direction.ASC, "2026-10-01", "e-2")));
    }

    private static Stream<Arguments> keysetsOfAnotherSort() {
        KeysetCursor severityAscending = KeysetCursor.ofString(SEVERITY, Sort.Direction.ASC, "INFO", "e-3");
        KeysetCursor newestFirst =
                KeysetCursor.ofInstant(EVENT_TIMESTAMP, Sort.Direction.DESC, Instant.ofEpochMilli(2000), "e-3");
        return Stream.of(
                arguments(severityAscending, SortInput.builder().field(SEVERITY).direction(SortDirection.DESC).build()),
                arguments(severityAscending, SortInput.builder().field("eventType").direction(SortDirection.ASC).build()),
                arguments(severityAscending, SortInput.builder().field(EVENT_TIMESTAMP).direction(SortDirection.ASC).build()),
                arguments(severityAscending, null),
                arguments(newestFirst, SortInput.builder().field(EVENT_TIMESTAMP).direction(SortDirection.ASC).build()),
                arguments(newestFirst, SortInput.builder().field(SEVERITY).direction(SortDirection.DESC).build()));
    }

    private static Stream<Arguments> textsThatAreNotALogPosition() {
        SortInput bySeverity = SortInput.builder().field(SEVERITY).direction(SortDirection.ASC).build();
        return Stream.of(
                arguments("garbage", null),
                arguments("65f1a2b3c4d5e6f708192a3b", null),
                arguments("2000", null),
                arguments("2000_", null),
                arguments("2000_ ", null),
                arguments("_e-3", null),
                arguments("abc_e-3", null),
                arguments("2000.5_e-3", null),
                arguments("2000 OR 1=1_e-3", null),
                arguments("1; DROP TABLE logs_e-3", null),
                arguments("k1|eventTimestamp|DESC", null),
                arguments("k1|eventTimestamp|DESC||e-3", null),
                arguments("k1|eventTimestamp|DESC|abc|e-3", null),
                arguments("k1|eventTimestamp|DESC|2000 OR 1=1|e-3", null),
                arguments("k1|eventTimestamp|DESC|1; DROP TABLE logs|e-3", null),
                arguments("k1|eventTimestamp|SIDEWAYS|2000|e-3", null),
                arguments("k1|severity|ASC||e-3", bySeverity),
                arguments("k1|severity|ASC|not base64!|e-3", bySeverity),
                arguments("65f1a2b3c4d5e6f708192a3b", bySeverity),
                arguments("garbage", bySeverity));
    }

    private static String severityCursor(int row) {
        LogProjection shown = ROWS.get(row - 1);
        return KeysetCursor.ofString(SEVERITY, Sort.Direction.ASC, shown.severity, shown.toolEventId).encode();
    }

    private static String timeCursor(int row) {
        LogProjection shown = ROWS.get(row - 1);
        return KeysetCursor.ofInstant(EVENT_TIMESTAMP, Sort.Direction.DESC, shown.eventTimestamp, shown.toolEventId).encode();
    }

    private static LogFilterCriteria noFilter() {
        return LogFilterCriteria.builder().build();
    }

    private static CursorPaginationCriteria page(int limit, String decodedCursor) {
        return CursorPaginationCriteria.builder().limit(limit).cursor(decodedCursor).build();
    }

    private static CursorPaginationCriteria forward(int first, String after) {
        ConnectionArgs args = ConnectionArgs.builder().first(first).after(after).build();
        return CursorPaginationCriteria.fromConnectionArgs(args);
    }

    private static CursorPaginationCriteria backward(int last, String before) {
        ConnectionArgs args = ConnectionArgs.builder().last(last).before(before).build();
        return CursorPaginationCriteria.fromConnectionArgs(args);
    }

    private static CursorPaginationCriteria connectionPage(boolean backward, int limit, String cursor) {
        return backward ? backward(limit, cursor) : forward(limit, cursor);
    }

    private static LogProjection row(String toolEventId, long millis, String severity, String eventType, String toolType,
                                     String organizationId, String deviceId, String ingestDay) {
        return LogProjection.builder()
                .toolEventId(toolEventId)
                .eventTimestamp(Instant.ofEpochMilli(millis))
                .severity(severity)
                .eventType(eventType)
                .toolType(toolType)
                .organizationId(organizationId)
                .deviceId(deviceId)
                .ingestDay(ingestDay)
                .build();
    }

    private static int ascending(LogSortPosition left, LogSortPosition right) {
        int byValue = left.isTimestamp()
                ? left.getTimestampMillis().compareTo(right.getTimestampMillis())
                : left.getTextValue().compareTo(right.getTextValue());
        return byValue != 0 ? byValue : left.getToolEventId().compareTo(right.getToolEventId());
    }

    private List<LogProjection> rowsPast(LogSortPosition position, int limit, String sortField, String sortDirection,
                                         boolean backward) {
        Comparator<LogSortPosition> ascending = LogServiceTest::ascending;
        Comparator<LogSortPosition> displayOrder = "DESC".equals(sortDirection) ? ascending.reversed() : ascending;
        Comparator<LogSortPosition> fetchOrder = backward ? displayOrder.reversed() : displayOrder;
        Function<LogProjection, LogSortPosition> positionOf = row -> positionIssuer.sortPositionOf(row, sortField);
        return ROWS.stream()
                .sorted(Comparator.comparing(positionOf, fetchOrder))
                .filter(row -> position == null || fetchOrder.compare(positionOf.apply(row), position) > 0)
                .limit(limit)
                .toList();
    }

    private void stubLogPages() {
        when(pinotLogRepository.findLogs(eq("t1"), any(), any(), any(), any(), any(), any(), any(), any(), any(),
                any(), anyInt(), any(), any(), anyBoolean()))
                .thenAnswer(call -> rowsPast(call.getArgument(10), call.getArgument(11), call.getArgument(12),
                        call.getArgument(13), call.getArgument(14)));
        when(pinotLogRepository.searchLogs(eq("t1"), any(), any(), any(), any(), any(), any(), any(), any(), any(),
                eq(SEARCH), any(), anyInt(), any(), any(), anyBoolean()))
                .thenAnswer(call -> rowsPast(call.getArgument(11), call.getArgument(12), call.getArgument(13),
                        call.getArgument(14), call.getArgument(15)));
    }

    private void verifyPinotNotAsked() {
        verify(pinotLogRepository, never()).findLogs(any(), any(), any(), any(), any(), any(), any(), any(), any(),
                any(), any(), anyInt(), any(), any(), anyBoolean());
        verify(pinotLogRepository, never()).searchLogs(any(), any(), any(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), anyInt(), any(), any(), anyBoolean());
    }

    private static LogFilterCriteria everyFilterField() {
        return LogFilterCriteria.builder()
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
    }

    private static List<LogProjection> logs(int count) {
        return IntStream.rangeClosed(1, count)
                .mapToObj(i -> LogProjection.builder().toolEventId("e-" + i).eventTimestamp(Instant.ofEpochMilli(i)).build())
                .toList();
    }
}
