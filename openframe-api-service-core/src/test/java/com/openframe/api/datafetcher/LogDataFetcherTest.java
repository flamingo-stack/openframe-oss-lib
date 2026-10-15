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
import com.openframe.data.loki.client.LokiQueryException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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
        fetcher = new LogDataFetcher(logService, logDetailsService, new GraphQLLogMapper());
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
}
