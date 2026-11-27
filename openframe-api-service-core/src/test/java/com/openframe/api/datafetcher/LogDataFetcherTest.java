package com.openframe.api.datafetcher;

import com.openframe.api.dto.GenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.audit.LogDetails;
import com.openframe.api.dto.audit.LogEvent;
import com.openframe.api.dto.audit.LogFilterCriteria;
import com.openframe.api.dto.audit.LogFilterInput;
import com.openframe.api.dto.audit.LogFilters;
import com.openframe.api.dto.audit.LogSortField;
import com.openframe.api.dto.audit.LogSortInput;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.mapper.GraphQLLogMapper;
import com.openframe.api.service.LogDetailsService;
import com.openframe.api.service.LogService;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.core.exception.InvalidCursorException;
import com.openframe.data.loki.client.LokiQueryException;
import com.openframe.data.repository.cursor.KeysetCursor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LogDataFetcherTest {

    private static final Instant TIMESTAMP = Instant.parse("2026-10-01T10:00:00.123Z");

    @Mock
    private LogService logService;

    @Mock
    private LogDetailsService logDetailsService;

    private LogDataFetcher fetcher;

    @BeforeEach
    void setUp() {
        fetcher = new LogDataFetcher(logService, logDetailsService, new GraphQLLogMapper(),
                mock(AuditedMethodRunner.class, CALLS_REAL_METHODS));
    }

    @Test
    void logDetails_eventFound_returnsItsDetails() {
        LogDetails stored = LogDetails.builder().id("1790848800123_evt-1").toolEventId("evt-1").build();
        when(logDetailsService.findLogDetails("2026-10-01", "FLEET", "LOGIN", TIMESTAMP, "evt-1"))
                .thenReturn(Optional.of(stored));

        LogDetails details = fetcher.logDetails("2026-10-01", "FLEET", "LOGIN", TIMESTAMP, "evt-1");

        assertThat(details).isSameAs(stored);
    }

    @Test
    void logDetails_nothingFound_returnsNull() {
        when(logDetailsService.findLogDetails("2026-10-01", "FLEET", "LOGIN", TIMESTAMP, "evt-1"))
                .thenReturn(Optional.empty());

        LogDetails details = fetcher.logDetails("2026-10-01", "FLEET", "LOGIN", TIMESTAMP, "evt-1");

        assertThat(details).isNull();
    }

    @Test
    void logDetails_lookupFails_passesTheFailureOn() {
        when(logDetailsService.findLogDetails("2026-10-01", "FLEET", "LOGIN", TIMESTAMP, "evt-1"))
                .thenThrow(new LokiQueryException("Loki did not answer"));

        assertThatThrownBy(() -> fetcher.logDetails("2026-10-01", "FLEET", "LOGIN", TIMESTAMP, "evt-1"))
                .isExactlyInstanceOf(LokiQueryException.class)
                .hasMessage("Loki did not answer");
    }

    @Test
    void logFilters_filterGiven_returnsTheOptionsForThatFilter() {
        LogFilters options = LogFilters.builder().toolTypes(List.of("FLEET", "RMM")).build();
        when(logService.getLogFilters(LogFilterCriteria.builder().toolTypes(List.of("FLEET")).build()))
                .thenReturn(options);

        LogFilters filters = fetcher.logFilters(LogFilterInput.builder().toolTypes(List.of("FLEET")).build());

        assertThat(filters).isSameAs(options);
    }

    @Test
    void logs_filterPageSearchAndSortGiven_returnsTheMatchingPageAsAConnection() {
        LogEvent event = LogEvent.builder().toolEventId("evt-1").timestamp(TIMESTAMP).build();
        PageInfo pageInfo = PageInfo.builder().hasNextPage(true).build();
        when(logService.queryLogs(
                LogFilterCriteria.builder().deviceId("device-7").build(),
                CursorPaginationCriteria.builder().limit(2).cursor("9_e-9").build(),
                "failed",
                SortInput.builder().field("eventTimestamp").direction(SortDirection.ASC).build()))
                .thenReturn(GenericQueryResult.<LogEvent>builder().items(List.of(event)).pageInfo(pageInfo).build());

        GenericConnection<GenericEdge<LogEvent>> connection = fetcher.logs(
                LogFilterInput.builder().deviceId("device-7").build(), 2, CursorCodec.encode("9_e-9"), null, null,
                "failed", LogSortInput.builder().field(LogSortField.TIMESTAMP).direction(SortDirection.ASC).build());

        assertThat(connection).isEqualTo(GenericConnection.<GenericEdge<LogEvent>>builder()
                .edges(List.of(GenericEdge.<LogEvent>builder()
                        .node(event)
                        .cursor(CursorCodec.encode("1790848800123_evt-1"))
                        .build()))
                .pageInfo(pageInfo)
                .build());
    }

    @Test
    void logs_lastAndBeforeGiven_asksForTheBackwardPageFromThatCursor() {
        PageInfo pageInfo = PageInfo.builder().hasPreviousPage(true).build();
        when(logService.queryLogs(
                LogFilterCriteria.builder().build(),
                CursorPaginationCriteria.builder().limit(3).cursor("5_e-5").backward(true).build(),
                null,
                null))
                .thenReturn(GenericQueryResult.<LogEvent>builder().items(List.of()).pageInfo(pageInfo).build());

        GenericConnection<GenericEdge<LogEvent>> connection =
                fetcher.logs(null, null, null, 3, CursorCodec.encode("5_e-5"), null, null);

        assertThat(connection.getPageInfo()).isSameAs(pageInfo);
    }

    @Test
    void logs_keysetCursorAsBefore_serviceGetsItsDecodedTextAndTheBackwardPage() {
        // setup
        KeysetCursor cursor = KeysetCursor.ofInstant("eventTimestamp", Sort.Direction.DESC, Instant.ofEpochMilli(5), "e-5");
        String before = cursor.encode();
        PageInfo pageInfo = PageInfo.builder().hasNextPage(true).build();
        when(logService.queryLogs(
                LogFilterCriteria.builder().build(),
                CursorPaginationCriteria.builder().limit(3).cursor("k1|eventTimestamp|DESC|5|e-5").backward(true).build(),
                null,
                null))
                .thenReturn(GenericQueryResult.<LogEvent>builder().items(List.of()).pageInfo(pageInfo).build());

        // execution
        GenericConnection<GenericEdge<LogEvent>> connection = fetcher.logs(null, null, null, 3, before, null, null);

        // verifications
        assertThat(connection.getPageInfo()).isSameAs(pageInfo);
    }

    @Test
    void logs_bothDirectionsGiven_lastAndBeforeWin() {
        // setup
        PageInfo pageInfo = PageInfo.builder().hasPreviousPage(true).build();
        String after = CursorCodec.encode("9_e-9");
        String before = CursorCodec.encode("5_e-5");
        when(logService.queryLogs(
                LogFilterCriteria.builder().build(),
                CursorPaginationCriteria.builder().limit(3).cursor("5_e-5").backward(true).build(),
                null,
                null))
                .thenReturn(GenericQueryResult.<LogEvent>builder().items(List.of()).pageInfo(pageInfo).build());

        // execution
        GenericConnection<GenericEdge<LogEvent>> connection = fetcher.logs(null, 2, after, 3, before, null, null);

        // verifications
        assertThat(connection.getPageInfo()).isSameAs(pageInfo);
    }

    @Test
    void logs_lastWithoutBefore_asksForTheLastRows() {
        // setup
        PageInfo pageInfo = PageInfo.builder().hasPreviousPage(true).build();
        when(logService.queryLogs(
                LogFilterCriteria.builder().build(),
                CursorPaginationCriteria.builder().limit(3).backward(true).build(),
                null,
                null))
                .thenReturn(GenericQueryResult.<LogEvent>builder().items(List.of()).pageInfo(pageInfo).build());

        // execution
        GenericConnection<GenericEdge<LogEvent>> connection = fetcher.logs(null, null, null, 3, null, null, null);

        // verifications
        assertThat(connection.getPageInfo()).isSameAs(pageInfo);
    }

    @Test
    void logs_pageCursorsOfTheService_passedOnAsTheyAre() {
        // setup
        String startCursor =
                KeysetCursor.ofInstant("eventTimestamp", Sort.Direction.DESC, Instant.ofEpochMilli(9), "e-9").encode();
        String endCursor =
                KeysetCursor.ofInstant("eventTimestamp", Sort.Direction.DESC, Instant.ofEpochMilli(5), "e-5").encode();
        PageInfo pageInfo = PageInfo.builder().startCursor(startCursor).endCursor(endCursor).build();
        when(logService.queryLogs(
                LogFilterCriteria.builder().build(),
                CursorPaginationCriteria.builder().limit(2).build(),
                null,
                null))
                .thenReturn(GenericQueryResult.<LogEvent>builder().items(List.of()).pageInfo(pageInfo).build());

        // execution
        GenericConnection<GenericEdge<LogEvent>> connection = fetcher.logs(null, 2, null, null, null, null, null);

        // verifications
        assertThat(connection.getPageInfo())
                .returns(startCursor, PageInfo::getStartCursor)
                .returns(endCursor, PageInfo::getEndCursor);
    }

    @ParameterizedTest
    @CsvSource({"not base64!, ", ", not base64!"})
    void logs_cursorIsNotBase64_throwsInvalidCursorAndTheServiceIsNotAsked(String after, String before) {
        // execution
        Throwable thrown = catchThrowable(() -> fetcher.logs(null, 2, after, null, before, null, null));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage("Invalid cursor");
        verifyNoInteractions(logService);
    }

    @Test
    void logs_serviceRejectsTheCursor_passesTheInvalidCursorErrorOn() {
        // setup
        String after = CursorCodec.encode("garbage");
        when(logService.queryLogs(
                LogFilterCriteria.builder().build(),
                CursorPaginationCriteria.builder().limit(2).cursor("garbage").build(),
                null,
                null))
                .thenThrow(new InvalidCursorException());

        // execution
        Throwable thrown = catchThrowable(() -> fetcher.logs(null, 2, after, null, null, null, null));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage("Invalid cursor");
    }
}
