package com.openframe.external.mapper;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.audit.LogDetails;
import com.openframe.api.dto.audit.LogEvent;
import com.openframe.api.dto.audit.LogFilters;
import com.openframe.api.dto.audit.OrganizationFilterOption;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.external.dto.audit.CustomerFilterResponse;
import com.openframe.external.dto.audit.LogDetailsResponse;
import com.openframe.external.dto.audit.LogFilterResponse;
import com.openframe.external.dto.audit.LogResponse;
import com.openframe.external.dto.audit.LogsResponse;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LogMapperTest {

    private static final Instant TIMESTAMP = Instant.parse("2024-01-15T10:00:00.123Z");

    private final LogMapper mapper = new LogMapper();

    @Test
    void logEventMapsEveryFieldAndRenamesOrganizationToCustomer() {
        LogResponse response = mapper.toLogResponse(logEvent("evt-1"));

        assertEquals("evt-1", response.getToolEventId());
        assertEquals("LOGIN", response.getEventType());
        assertEquals("2024-01-15", response.getIngestDay());
        assertEquals("MESHCENTRAL", response.getToolType());
        assertEquals("INFO", response.getSeverity());
        assertEquals("user-7", response.getUserId());
        assertEquals("device-7", response.getDeviceId());
        assertEquals("host-7", response.getHostname());
        assertEquals("nick-7", response.getNickname());
        assertEquals("org-7", response.getCustomerId());
        assertEquals("Acme", response.getCustomerName());
        assertEquals("User logged in", response.getSummary());
        assertEquals(TIMESTAMP, response.getTimestamp());
    }

    @Test
    void emptyLogEventMapsToResponseWithNullFields() {
        LogResponse response = mapper.toLogResponse(new LogEvent());

        assertEquals(new LogResponse(), response);
    }

    @Test
    void nullLogEventMapsToNull() {
        assertNull(mapper.toLogResponse(null));
    }

    @Test
    void queryResultMapsItemsInOrderAndKeepsPageInfo() {
        PageInfo pageInfo = PageInfo.builder().hasNextPage(true).startCursor("s").endCursor("e").build();
        GenericQueryResult<LogEvent> result = GenericQueryResult.<LogEvent>builder()
                .items(List.of(logEvent("evt-1"), logEvent("evt-2")))
                .pageInfo(pageInfo)
                .build();

        LogsResponse response = mapper.toLogsResponse(result);

        assertEquals(List.of("evt-1", "evt-2"), response.getLogs().stream().map(LogResponse::getToolEventId).toList());
        assertSame(pageInfo, response.getPageInfo());
    }

    @Test
    void emptyQueryResultMapsToEmptyLogs() {
        GenericQueryResult<LogEvent> result = GenericQueryResult.<LogEvent>builder().items(List.of()).build();

        LogsResponse response = mapper.toLogsResponse(result);

        assertTrue(response.getLogs().isEmpty());
        assertNull(response.getPageInfo());
    }

    @Test
    void nullQueryResultMapsToEmptyLogsWithoutPageInfo() {
        LogsResponse response = mapper.toLogsResponse(null);

        assertTrue(response.getLogs().isEmpty());
        assertNull(response.getPageInfo());
    }

    @Test
    void filtersMapListsAndTurnOrganizationsIntoCustomers() {
        LogFilters filters = LogFilters.builder()
                .toolTypes(List.of("MESHCENTRAL", "TACTICAL"))
                .eventTypes(List.of("LOGIN"))
                .severities(List.of("INFO", "ERROR"))
                .organizations(List.of(
                        new OrganizationFilterOption("org-1", "Acme"),
                        new OrganizationFilterOption("org-2", "Globex")))
                .build();

        LogFilterResponse response = mapper.toLogFilterResponse(filters);

        assertEquals(List.of("MESHCENTRAL", "TACTICAL"), response.getToolTypes());
        assertEquals(List.of("LOGIN"), response.getEventTypes());
        assertEquals(List.of("INFO", "ERROR"), response.getSeverities());
        assertEquals(List.of(
                new CustomerFilterResponse("org-1", "Acme"),
                new CustomerFilterResponse("org-2", "Globex")), response.getCustomers());
    }

    @Test
    void nullFiltersMapToEmptyResponse() {
        LogFilterResponse response = mapper.toLogFilterResponse(null);

        assertEquals(new LogFilterResponse(), response);
    }

    @Test
    void logDetailsMapEveryFieldAndExposeDetailsAsContent() {
        LogDetails details = LogDetails.builder()
                .id("internal-id")
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
                .timestamp(TIMESTAMP)
                .message("login ok")
                .details("{\"ip\":\"10.0.0.1\"}")
                .build();

        LogDetailsResponse response = mapper.toLogDetailsResponse(details);

        assertEquals("evt-1", response.getToolEventId());
        assertEquals("LOGIN", response.getEventType());
        assertEquals("2024-01-15", response.getIngestDay());
        assertEquals("MESHCENTRAL", response.getToolType());
        assertEquals("INFO", response.getSeverity());
        assertEquals("user-7", response.getUserId());
        assertEquals("device-7", response.getDeviceId());
        assertEquals("host-7", response.getHostname());
        assertEquals("nick-7", response.getNickname());
        assertEquals("org-7", response.getCustomerId());
        assertEquals("Acme", response.getCustomerName());
        assertEquals("User logged in", response.getSummary());
        assertEquals("login ok", response.getMessage());
        assertEquals("{\"ip\":\"10.0.0.1\"}", response.getContent());
        assertEquals(TIMESTAMP, response.getTimestamp());
    }

    @Test
    void nullLogDetailsMapToNull() {
        assertNull(mapper.toLogDetailsResponse(null));
    }

    private static LogEvent logEvent(String toolEventId) {
        return LogEvent.builder()
                .id("internal-id")
                .toolEventId(toolEventId)
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
                .timestamp(TIMESTAMP)
                .build();
    }
}
