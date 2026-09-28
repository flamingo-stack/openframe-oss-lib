package com.openframe.external.controller;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.audit.LogDetails;
import com.openframe.api.dto.audit.LogEvent;
import com.openframe.api.dto.audit.LogFilterCriteria;
import com.openframe.api.dto.audit.LogFilters;
import com.openframe.api.dto.audit.OrganizationFilterOption;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.service.LogService;
import com.openframe.data.pinot.repository.exception.PinotQueryException;
import com.openframe.external.mapper.LogMapper;
import com.openframe.external.support.ExternalApiMockMvc;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class LogControllerTest {

    private static final String BASE = "/api/v1/logs";
    private static final Instant TIMESTAMP = Instant.parse("2024-01-15T10:00:00.123Z");

    @Mock
    private LogService logService;

    @Captor
    private ArgumentCaptor<LogFilterCriteria> filterCaptor;
    @Captor
    private ArgumentCaptor<CursorPaginationCriteria> paginationCaptor;
    @Captor
    private ArgumentCaptor<SortInput> sortCaptor;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = ExternalApiMockMvc.standalone(new LogController(logService, new LogMapper()));
    }

    @Test
    void logsAreReturnedWithPageInfo() throws Exception {
        LogEvent event = LogEvent.builder()
                .toolEventId("evt-1")
                .eventType("LOGIN")
                .ingestDay("2024-01-15")
                .toolType("MESHCENTRAL")
                .severity("INFO")
                .userId("user-7")
                .deviceId("device-7")
                .hostname("host-7")
                .nickname("nick-7")
                .organizationId("org-7")
                .organizationName("Acme")
                .summary("User logged in")
                .timestamp(Instant.parse("2024-01-15T10:00:00.123456Z"))
                .build();
        PageInfo pageInfo = PageInfo.builder().hasNextPage(true).startCursor("c3RhcnQ=").endCursor("ZW5k").build();
        when(logService.queryLogs(any(), any(), any(), any())).thenReturn(
                GenericQueryResult.<LogEvent>builder().items(List.of(event)).pageInfo(pageInfo).build());

        mockMvc.perform(get(BASE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.logs.length()").value(1))
                .andExpect(jsonPath("$.logs[0].toolEventId").value("evt-1"))
                .andExpect(jsonPath("$.logs[0].eventType").value("LOGIN"))
                .andExpect(jsonPath("$.logs[0].ingestDay").value("2024-01-15"))
                .andExpect(jsonPath("$.logs[0].toolType").value("MESHCENTRAL"))
                .andExpect(jsonPath("$.logs[0].severity").value("INFO"))
                .andExpect(jsonPath("$.logs[0].userId").value("user-7"))
                .andExpect(jsonPath("$.logs[0].deviceId").value("device-7"))
                .andExpect(jsonPath("$.logs[0].hostname").value("host-7"))
                .andExpect(jsonPath("$.logs[0].nickname").value("nick-7"))
                .andExpect(jsonPath("$.logs[0].customerId").value("org-7"))
                .andExpect(jsonPath("$.logs[0].customerName").value("Acme"))
                .andExpect(jsonPath("$.logs[0].summary").value("User logged in"))
                .andExpect(jsonPath("$.logs[0].timestamp").value("2024-01-15T10:00:00.123Z"))
                .andExpect(jsonPath("$.logs[0].organizationId").doesNotExist())
                .andExpect(jsonPath("$.pageInfo.hasNextPage").value(true))
                .andExpect(jsonPath("$.pageInfo.hasPreviousPage").value(false))
                .andExpect(jsonPath("$.pageInfo.startCursor").value("c3RhcnQ="))
                .andExpect(jsonPath("$.pageInfo.endCursor").value("ZW5k"));
    }

    @Test
    void everyQueryParamLandsInItsFilterPaginationSearchOrSortField() throws Exception {
        when(logService.queryLogs(any(), any(), any(), any())).thenReturn(emptyResult());

        mockMvc.perform(get(BASE)
                        .param("startDate", "2024-01-01")
                        .param("endDate", "2024-01-31")
                        .param("timestampFrom", "2024-01-15T10:00:00Z")
                        .param("timestampTo", "2024-01-15T11:30:00.500Z")
                        .param("toolTypes", "MESHCENTRAL", "TACTICAL")
                        .param("eventTypes", "LOGIN,LOGOUT")
                        .param("severities", "ERROR")
                        .param("customerIds", "org-1", "org-2")
                        .param("deviceId", "device-7")
                        .param("search", "failed login")
                        .param("limit", "50")
                        .param("cursor", CursorCodec.encode("1705312800000_evt-1"))
                        .param("sortField", "eventTimestamp")
                        .param("sortDirection", "ASC"))
                .andExpect(status().isOk());

        ArgumentCaptor<String> searchCaptor = ArgumentCaptor.forClass(String.class);
        verify(logService).queryLogs(filterCaptor.capture(), paginationCaptor.capture(), searchCaptor.capture(), sortCaptor.capture());
        LogFilterCriteria filter = filterCaptor.getValue();
        assertEquals(LocalDate.of(2024, 1, 1), filter.getStartDate());
        assertEquals(LocalDate.of(2024, 1, 31), filter.getEndDate());
        assertEquals(Instant.parse("2024-01-15T10:00:00Z"), filter.getTimestampFrom());
        assertEquals(Instant.parse("2024-01-15T11:30:00.500Z"), filter.getTimestampTo());
        assertEquals(List.of("MESHCENTRAL", "TACTICAL"), filter.getToolTypes());
        assertEquals(List.of("LOGIN", "LOGOUT"), filter.getEventTypes());
        assertEquals(List.of("ERROR"), filter.getSeverities());
        assertEquals(List.of("org-1", "org-2"), filter.getOrganizationIds());
        assertEquals("device-7", filter.getDeviceId());
        CursorPaginationCriteria pagination = paginationCaptor.getValue();
        assertEquals(50, pagination.getLimit());
        assertEquals("1705312800000_evt-1", pagination.getCursor());
        assertFalse(pagination.isBackward());
        assertEquals("failed login", searchCaptor.getValue());
        assertEquals(new SortInput("eventTimestamp", SortDirection.ASC), sortCaptor.getValue());
    }

    @Test
    void noParamsMeansEmptyFilterFirstPageOfTwentyAndNoSort() throws Exception {
        when(logService.queryLogs(any(), any(), any(), any())).thenReturn(emptyResult());

        mockMvc.perform(get(BASE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.logs").isEmpty());

        verify(logService).queryLogs(filterCaptor.capture(), paginationCaptor.capture(), isNull(), isNull());
        assertEquals(new LogFilterCriteria(), filterCaptor.getValue());
        assertEquals(20, paginationCaptor.getValue().getLimit());
        assertNull(paginationCaptor.getValue().getCursor());
    }

    @Test
    void sortDirectionDefaultsToDescWhenOnlySortFieldIsGiven() throws Exception {
        when(logService.queryLogs(any(), any(), any(), any())).thenReturn(emptyResult());

        mockMvc.perform(get(BASE).param("sortField", "severity"))
                .andExpect(status().isOk());

        verify(logService).queryLogs(any(), any(), isNull(), sortCaptor.capture());
        assertEquals(new SortInput("severity", SortDirection.DESC), sortCaptor.getValue());
    }

    @Test
    void sortDirectionIsCaseInsensitive() throws Exception {
        when(logService.queryLogs(any(), any(), any(), any())).thenReturn(emptyResult());

        mockMvc.perform(get(BASE).param("sortField", "severity").param("sortDirection", "asc"))
                .andExpect(status().isOk());

        verify(logService).queryLogs(any(), any(), isNull(), sortCaptor.capture());
        assertEquals(SortDirection.ASC, sortCaptor.getValue().getDirection());
    }

    @ParameterizedTest
    @ValueSource(strings = {"1", "100"})
    void limitBoundsAreAccepted(String limit) throws Exception {
        when(logService.queryLogs(any(), any(), any(), any())).thenReturn(emptyResult());

        mockMvc.perform(get(BASE).param("limit", limit))
                .andExpect(status().isOk());

        verify(logService).queryLogs(any(), paginationCaptor.capture(), isNull(), isNull());
        assertEquals(Integer.valueOf(limit), paginationCaptor.getValue().getLimit());
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "-1", "101"})
    void limitOutOfRangeIs400AndNeverReachesTheDomain(String limit) throws Exception {
        mockMvc.perform(get(BASE).param("limit", limit))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("limit"));

        verifyNoInteractions(logService);
    }

    @Test
    void nonNumericLimitIs400TypeMismatch() throws Exception {
        mockMvc.perform(get(BASE).param("limit", "many"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TYPE_MISMATCH"))
                .andExpect(jsonPath("$.message").value("Invalid value 'many' for parameter 'limit'"));

        verifyNoInteractions(logService);
    }

    @ParameterizedTest
    @ValueSource(strings = {"startDate", "endDate"})
    void malformedDateIs400TypeMismatch(String param) throws Exception {
        mockMvc.perform(get(BASE).param(param, "15/01/2024"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TYPE_MISMATCH"))
                .andExpect(jsonPath("$.message").value("Invalid value '15/01/2024' for parameter '" + param + "'"));

        verifyNoInteractions(logService);
    }

    @ParameterizedTest
    @ValueSource(strings = {"timestampFrom", "timestampTo"})
    void malformedTimestampBoundIs400TypeMismatch(String param) throws Exception {
        mockMvc.perform(get(BASE).param(param, "2024-01-15"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TYPE_MISMATCH"))
                .andExpect(jsonPath("$.message").value("Invalid value '2024-01-15' for parameter '" + param + "'"));

        verifyNoInteractions(logService);
    }

    @Test
    void unreadableCursorIs400AndNeverReachesTheDomain() throws Exception {
        mockMvc.perform(get(BASE).param("cursor", "not base64!"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.message").value("Invalid cursor: not base64!"));

        verifyNoInteractions(logService);
    }

    @Test
    void blankCursorMeansFirstPage() throws Exception {
        when(logService.queryLogs(any(), any(), any(), any())).thenReturn(emptyResult());

        mockMvc.perform(get(BASE).param("cursor", " "))
                .andExpect(status().isOk());

        verify(logService).queryLogs(any(), paginationCaptor.capture(), isNull(), isNull());
        assertNull(paginationCaptor.getValue().getCursor());
    }

    @Test
    void pinotFailureOnQueryIs503() throws Exception {
        when(logService.queryLogs(any(), any(), any(), any())).thenThrow(new PinotQueryException("broker down"));

        mockMvc.perform(get(BASE))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("PINOT_QUERY_ERROR"))
                .andExpect(jsonPath("$.message").value("Query service temporarily unavailable. Please try again later."));
    }

    @Test
    void logFiltersAreReturnedWithCustomers() throws Exception {
        when(logService.getLogFilters(any())).thenReturn(LogFilters.builder()
                .toolTypes(List.of("MESHCENTRAL", "TACTICAL"))
                .eventTypes(List.of("LOGIN"))
                .severities(List.of("INFO", "ERROR"))
                .organizations(List.of(new OrganizationFilterOption("org-1", "Acme")))
                .build());

        mockMvc.perform(get(BASE + "/filters"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.toolTypes[0]").value("MESHCENTRAL"))
                .andExpect(jsonPath("$.toolTypes[1]").value("TACTICAL"))
                .andExpect(jsonPath("$.eventTypes[0]").value("LOGIN"))
                .andExpect(jsonPath("$.severities.length()").value(2))
                .andExpect(jsonPath("$.customers.length()").value(1))
                .andExpect(jsonPath("$.customers[0].id").value("org-1"))
                .andExpect(jsonPath("$.customers[0].name").value("Acme"))
                .andExpect(jsonPath("$.organizations").doesNotExist());
    }

    @Test
    void logFiltersParamsLandInFilterCriteria() throws Exception {
        when(logService.getLogFilters(any())).thenReturn(emptyFilters());

        mockMvc.perform(get(BASE + "/filters")
                        .param("startDate", "2024-01-01")
                        .param("endDate", "2024-01-31")
                        .param("toolTypes", "MESHCENTRAL")
                        .param("eventTypes", "LOGIN", "LOGOUT")
                        .param("severities", "ERROR", "WARNING")
                        .param("customerIds", "org-1"))
                .andExpect(status().isOk());

        verify(logService).getLogFilters(filterCaptor.capture());
        assertEquals(LogFilterCriteria.builder()
                .startDate(LocalDate.of(2024, 1, 1))
                .endDate(LocalDate.of(2024, 1, 31))
                .toolTypes(List.of("MESHCENTRAL"))
                .eventTypes(List.of("LOGIN", "LOGOUT"))
                .severities(List.of("ERROR", "WARNING"))
                .organizationIds(List.of("org-1"))
                .build(), filterCaptor.getValue());
    }

    @Test
    void logFiltersWithoutParamsUseEmptyCriteria() throws Exception {
        when(logService.getLogFilters(any())).thenReturn(emptyFilters());

        mockMvc.perform(get(BASE + "/filters"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customers").isEmpty());

        verify(logService).getLogFilters(new LogFilterCriteria());
    }

    @Test
    void logFiltersMalformedDateIs400TypeMismatch() throws Exception {
        mockMvc.perform(get(BASE + "/filters").param("endDate", "yesterday"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TYPE_MISMATCH"));

        verifyNoInteractions(logService);
    }

    @Test
    void pinotFailureOnFiltersIs503() throws Exception {
        when(logService.getLogFilters(any())).thenThrow(new PinotQueryException("broker down"));

        mockMvc.perform(get(BASE + "/filters"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("PINOT_QUERY_ERROR"));
    }

    @Test
    void logDetailsAreReturnedForTheRequestedKey() throws Exception {
        when(logService.findLogDetails("2024-01-15", "MESHCENTRAL", "LOGIN", TIMESTAMP, "evt-1"))
                .thenReturn(Optional.of(LogDetails.builder()
                        .toolEventId("evt-1")
                        .eventType("LOGIN")
                        .ingestDay("2024-01-15")
                        .toolType("MESHCENTRAL")
                        .severity("INFO")
                        .userId("user-7")
                        .deviceId("device-7")
                        .hostname("host-7")
                        .nickname("nick-7")
                        .organizationId("org-7")
                        .organizationName("Acme")
                        .summary("User logged in")
                        .message("login ok")
                        .details("{\"ip\":\"10.0.0.1\"}")
                        .timestamp(TIMESTAMP)
                        .build()));

        mockMvc.perform(detailsRequest())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.toolEventId").value("evt-1"))
                .andExpect(jsonPath("$.eventType").value("LOGIN"))
                .andExpect(jsonPath("$.ingestDay").value("2024-01-15"))
                .andExpect(jsonPath("$.toolType").value("MESHCENTRAL"))
                .andExpect(jsonPath("$.severity").value("INFO"))
                .andExpect(jsonPath("$.userId").value("user-7"))
                .andExpect(jsonPath("$.deviceId").value("device-7"))
                .andExpect(jsonPath("$.hostname").value("host-7"))
                .andExpect(jsonPath("$.nickname").value("nick-7"))
                .andExpect(jsonPath("$.customerId").value("org-7"))
                .andExpect(jsonPath("$.customerName").value("Acme"))
                .andExpect(jsonPath("$.summary").value("User logged in"))
                .andExpect(jsonPath("$.message").value("login ok"))
                .andExpect(jsonPath("$.content").value("{\"ip\":\"10.0.0.1\"}"))
                .andExpect(jsonPath("$.timestamp").value("2024-01-15T10:00:00.123Z"))
                .andExpect(jsonPath("$.details").doesNotExist());
    }

    @Test
    void unknownLogIs404WithLogNotFoundCode() throws Exception {
        when(logService.findLogDetails("2024-01-15", "MESHCENTRAL", "LOGIN", TIMESTAMP, "evt-1"))
                .thenReturn(Optional.empty());

        mockMvc.perform(detailsRequest())
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("LOG_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("Log not found for toolEventId: evt-1, ingestDay: 2024-01-15, "
                        + "toolType: MESHCENTRAL, eventType: LOGIN, timestamp: 2024-01-15T10:00:00.123Z"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"ingestDay", "toolType", "eventType", "timestamp", "toolEventId"})
    void logDetailsMissingRequiredParamIs400(String missing) throws Exception {
        MockHttpServletRequestBuilder request = get(BASE + "/details");
        for (String param : List.of("ingestDay", "toolType", "eventType", "timestamp", "toolEventId")) {
            if (!param.equals(missing)) {
                request.param(param, param.equals("timestamp") ? TIMESTAMP.toString() : "value");
            }
        }

        mockMvc.perform(request)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.message").value("Required parameter '" + missing + "' is missing"));

        verifyNoInteractions(logService);
    }

    @Test
    void logDetailsMalformedTimestampIs400TypeMismatch() throws Exception {
        mockMvc.perform(get(BASE + "/details")
                        .param("ingestDay", "2024-01-15")
                        .param("toolType", "MESHCENTRAL")
                        .param("eventType", "LOGIN")
                        .param("timestamp", "yesterday")
                        .param("toolEventId", "evt-1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TYPE_MISMATCH"))
                .andExpect(jsonPath("$.message").value("Invalid value 'yesterday' for parameter 'timestamp'"));

        verifyNoInteractions(logService);
    }

    @Test
    void databaseFailureOnDetailsIs503() throws Exception {
        when(logService.findLogDetails(any(), any(), any(), any(), any()))
                .thenThrow(new DataAccessResourceFailureException("cassandra down"));

        mockMvc.perform(detailsRequest())
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("DATABASE_ERROR"))
                .andExpect(jsonPath("$.message").value("Database operation failed. Please try again later."));
    }

    private static MockHttpServletRequestBuilder detailsRequest() {
        return get(BASE + "/details")
                .param("ingestDay", "2024-01-15")
                .param("toolType", "MESHCENTRAL")
                .param("eventType", "LOGIN")
                .param("timestamp", TIMESTAMP.toString())
                .param("toolEventId", "evt-1");
    }

    private static GenericQueryResult<LogEvent> emptyResult() {
        return GenericQueryResult.<LogEvent>builder().items(List.of()).pageInfo(new PageInfo()).build();
    }

    private static LogFilters emptyFilters() {
        return LogFilters.builder()
                .toolTypes(List.of()).eventTypes(List.of()).severities(List.of()).organizations(List.of())
                .build();
    }
}
