package com.openframe.test.tests.external;

import com.openframe.test.api.external.ExternalLogApi;
import com.openframe.test.data.dto.external.common.ExternalErrorResponse;
import com.openframe.test.data.dto.external.log.LogDetailsResponse;
import com.openframe.test.data.dto.external.log.LogFilterResponse;
import com.openframe.test.data.dto.external.log.LogResponse;
import com.openframe.test.data.dto.external.log.LogsResponse;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.condition.EnabledIf;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@code /api/v1/logs} — tool and audit events.
 *
 * <p>Backed by Pinot rather than Mongo, so these are the only External API reads that can legitimately
 * return {@code 503 PINOT_QUERY_ERROR}. Cases tolerate an empty tenant but not a malformed response.
 */
@Tag("saas")
@Tag("external-api")
@EnabledIf(ExternalApiBaseTest.EXTERNAL_API_KEY_CONDITION)
@DisplayName("External API - Logs")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@Slf4j
public class ExternalLogsTest extends ExternalApiBaseTest {

    @Tag("feature")
    @Tag("read")
    @Order(1)
    @Test
    @DisplayName("List logs")
    public void testListLogs() {
        LogsResponse response = ExternalLogApi.listLogs(Map.of("limit", 10));

        assertThat(response.getPageInfo()).as("Paginated response should carry pageInfo").isNotNull();
        assertThat(response.getLogs()).as("Logs collection should be present, even if empty").isNotNull();
        assertThat(response.getLogs()).as("Page should respect the requested limit").hasSizeLessThanOrEqualTo(10);
        assertThat(response.getLogs()).allSatisfy(entry -> {
            assertThat(entry.getToolEventId()).as("Log toolEventId should not be null").isNotNull();
            assertThat(entry.getEventType()).as("Log eventType should not be null").isNotNull();
            assertThat(entry.getToolType()).as("Log toolType should not be null").isNotNull();
            assertThat(entry.getIngestDay()).as("Log ingestDay should not be null").isNotNull();
            assertThat(entry.getTimestamp()).as("Log timestamp should not be null").isNotNull();
        });
    }

    @Tag("feature")
    @Tag("read")
    @Order(2)
    @Test
    @DisplayName("Get log filter options")
    public void testGetLogFilters() {
        LogFilterResponse filters = ExternalLogApi.getFilters();

        assertThat(filters).as("Filter response should not be null").isNotNull();
        assertThat(filters.getEventTypes()).as("Event types should not contain nulls").doesNotContainNull();
        assertThat(filters.getToolTypes()).as("Tool types should not contain nulls").doesNotContainNull();
        assertThat(filters.getSeverities()).as("Severities should not contain nulls").doesNotContainNull();
        if (filters.getCustomers() != null) {
            assertThat(filters.getCustomers()).allSatisfy(customer -> {
                assertThat(customer.getId()).as("Customer filter option id").isNotNull();
                assertThat(customer.getName()).as("Customer filter option name").isNotNull();
            });
        }
    }

    @Tag("feature")
    @Tag("read")
    @Order(3)
    @Test
    @DisplayName("Filter logs by an advertised severity")
    public void testFilterLogsBySeverity() {
        List<String> severities = ExternalLogApi.getFilters().getSeverities();
        if (severities == null || severities.isEmpty()) {
            log.info("No severities advertised on this tenant; nothing to filter by");
            return;
        }

        String severity = severities.getFirst();
        LogsResponse response = ExternalLogApi.listLogs(Map.of("severities", severity, "limit", 10));

        assertThat(response.getLogs()).as("Severity '%s' is advertised as a filter option", severity)
                .isNotEmpty();
        assertThat(response.getLogs()).as("Every returned log should carry the requested severity")
                .allSatisfy(entry -> assertThat(entry.getSeverity()).isEqualTo(severity));
    }

    @Tag("feature")
    @Tag("read")
    @Order(4)
    @Test
    @DisplayName("Get log details for a listed log")
    public void testGetLogDetails() {
        List<LogResponse> logs = ExternalLogApi.listLogs(Map.of("limit", 1)).getLogs();
        if (logs.isEmpty()) {
            log.info("No logs on this tenant; skipping the details round-trip");
            return;
        }

        LogResponse entry = logs.getFirst();
        LogDetailsResponse details = ExternalLogApi.getDetails(
                entry.getIngestDay(), entry.getToolType(), entry.getEventType(),
                entry.getTimestamp().toString(), entry.getToolEventId());

        // The details endpoint takes the five fields the list returns as its composite key, so the
        // summary fields must agree — a mismatch means the key does not identify the row it came from.
        assertThat(details.getToolEventId()).as("Details should be for the requested event")
                .isEqualTo(entry.getToolEventId());
        assertThat(details.getEventType()).as("Event type should match the listed log")
                .isEqualTo(entry.getEventType());
        assertThat(details.getToolType()).as("Tool type should match the listed log")
                .isEqualTo(entry.getToolType());
        assertThat(details.getTimestamp()).as("Timestamp should match the listed log")
                .isEqualTo(entry.getTimestamp());
    }

    @Tag("feature")
    @Tag("read")
    @Order(5)
    @Test
    @DisplayName("Log details rejects a request missing a required parameter")
    public void testGetLogDetailsRequiresAllParams() {
        List<LogResponse> logs = ExternalLogApi.listLogs(Map.of("limit", 1)).getLogs();
        if (logs.isEmpty()) {
            log.info("No logs on this tenant; skipping the required-parameter case");
            return;
        }

        LogResponse entry = logs.getFirst();
        Map<String, Object> params = new HashMap<>(ExternalLogApi.detailParams(
                entry.getIngestDay(), entry.getToolType(), entry.getEventType(),
                entry.getTimestamp().toString(), entry.getToolEventId()));
        params.remove("toolEventId");

        ExternalErrorResponse error = ExternalLogApi.attemptGetDetails(params, 400);
        assertThat(error.getCode()).as("Missing required query parameter should be a client error")
                .isNotNull();
    }

    @Tag("feature")
    @Tag("read")
    @Order(6)
    @Test
    @DisplayName("Log details returns 404 for an unknown event")
    public void testGetLogDetailsUnknownEvent() {
        List<LogResponse> logs = ExternalLogApi.listLogs(Map.of("limit", 1)).getLogs();
        if (logs.isEmpty()) {
            log.info("No logs on this tenant; skipping the unknown-event case");
            return;
        }

        // A well-formed key that cannot exist: everything real, only the event id replaced.
        LogResponse entry = logs.getFirst();
        Map<String, Object> params = ExternalLogApi.detailParams(
                entry.getIngestDay(), entry.getToolType(), entry.getEventType(),
                entry.getTimestamp().toString(), "00000000-0000-0000-0000-000000000000");

        ExternalErrorResponse error = ExternalLogApi.attemptGetDetails(params, 404);
        assertThat(error.getCode()).as("Unknown log event should report an error code").isNotNull();
    }
}
