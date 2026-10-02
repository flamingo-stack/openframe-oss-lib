package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
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
import com.openframe.api.service.LogService;
import com.openframe.data.loki.toolevent.ToolEventLogRepository;
import com.openframe.data.pinot.repository.PinotLogRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LogDataFetcherTest {

    private static final Instant TIMESTAMP = Instant.parse("2026-10-01T10:00:00.123Z");

    @Mock
    private LogService logService;

    private LogDataFetcher fetcher;

    @BeforeEach
    void setUp() {
        fetcher = new LogDataFetcher(logService, new GraphQLLogMapper());
    }

    @Test
    void logDetails_eventFound_returnsItsDetails() {
        LogDetails stored = LogDetails.builder().id("1790848800123_evt-1").toolEventId("evt-1").build();
        when(logService.findLogDetails("FLEET", "LOGIN", TIMESTAMP, "evt-1"))
                .thenReturn(Optional.of(stored));

        LogDetails details = fetcher.logDetails("2026-10-01", "FLEET", "LOGIN", TIMESTAMP, "evt-1");

        assertThat(details).isSameAs(stored);
    }

    @Test
    void logDetails_nothingFound_returnsNull() {
        when(logService.findLogDetails("FLEET", "LOGIN", TIMESTAMP, "evt-1"))
                .thenReturn(Optional.empty());

        LogDetails details = fetcher.logDetails("2026-10-01", "FLEET", "LOGIN", TIMESTAMP, "evt-1");

        assertThat(details).isNull();
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
    void logEventId_event_returnsItsRelayGlobalId() {
        DgsDataFetchingEnvironment environment = environmentOf(LogEvent.builder().id("1790848800123_evt-1").build());

        assertThat(fetcher.logEventId(environment)).isEqualTo("TG9nRXZlbnQ6MTc5MDg0ODgwMDEyM19ldnQtMQ");
    }

    @Test
    void logDetailsId_details_returnsTheirRelayGlobalId() {
        DgsDataFetchingEnvironment environment = environmentOf(LogDetails.builder().id("1790848800123_evt-1").build());

        assertThat(fetcher.logDetailsId(environment)).isEqualTo("TG9nRGV0YWlsczoxNzkwODQ4ODAwMTIzX2V2dC0x");
    }

    @Test
    void logsSection_lokiEnabledAndCassandraOff_registersTheFetcherAndItsService() {
        logsSectionContext().withPropertyValues("openframe.loki.enabled=true", "spring.data.cassandra.enabled=false")
                .run(context -> assertThat(context)
                        .hasSingleBean(LogDataFetcher.class)
                        .hasSingleBean(LogService.class));
    }

    @Test
    void logsSection_lokiSwitchOff_registersNeitherTheFetcherNorItsService() {
        logsSectionContext().withPropertyValues("openframe.loki.enabled=false")
                .run(context -> assertThat(context)
                        .doesNotHaveBean(LogDataFetcher.class)
                        .doesNotHaveBean(LogService.class));
    }

    @Test
    void logsSection_onlyTheOldCassandraSwitchOn_registersNeitherTheFetcherNorItsService() {
        logsSectionContext().withPropertyValues("spring.data.cassandra.enabled=true")
                .run(context -> assertThat(context)
                        .doesNotHaveBean(LogDataFetcher.class)
                        .doesNotHaveBean(LogService.class));
    }

    private static DgsDataFetchingEnvironment environmentOf(Object source) {
        DgsDataFetchingEnvironment environment = mock(DgsDataFetchingEnvironment.class);
        when(environment.getSource()).thenReturn(source);
        return environment;
    }

    private static ApplicationContextRunner logsSectionContext() {
        return new ApplicationContextRunner()
                .withBean(PinotLogRepository.class, () -> mock(PinotLogRepository.class))
                .withBean(ToolEventLogRepository.class, () -> mock(ToolEventLogRepository.class))
                .withBean(TenantIdProvider.class, () -> mock(TenantIdProvider.class))
                .withUserConfiguration(GraphQLLogMapper.class, LogService.class, LogDataFetcher.class);
    }
}
