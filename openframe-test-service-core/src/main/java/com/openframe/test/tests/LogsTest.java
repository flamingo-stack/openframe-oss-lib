package com.openframe.test.tests;

import com.openframe.test.api.LogsApi;
import com.openframe.test.data.dto.log.LogDetails;
import com.openframe.test.data.dto.log.LogEvent;
import com.openframe.test.data.dto.log.LogFilters;
import com.openframe.test.data.generator.LogGenerator;
import com.openframe.test.tests.base.AuthorizedTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@Tag("shared")
@DisplayName("Logs")
public class LogsTest extends AuthorizedTest {

    @Tag("monitor")
    @Test
    @DisplayName("Get log filters")
    public void testGetLogFilters() {
        LogFilters filters = LogsApi.getLogFilters();
        assertThat(filters).isNotNull();
        assertThat(filters.getToolTypes()).as("Expected at least one tool type").isNotEmpty();
        assertThat(filters.getEventTypes()).as("Expected at least one event type").isNotEmpty();
        assertThat(filters.getSeverities()).as("Expected at least one severity").isNotEmpty();
    }

    @Tag("monitor")
    @Test
    @DisplayName("List logs")
    public void testListLogs() {
        List<LogEvent> logs = LogsApi.getLogs();
        assertThat(logs).as("Expected at least one log").isNotEmpty();
        assertThat(logs).allSatisfy(log -> {
            assertThat(log.getToolEventId()).isNotNull();
            assertThat(log.getEventType()).isNotEmpty();
            assertThat(log.getToolType()).isNotEmpty();
            assertThat(log.getTimestamp()).isNotEmpty();
            assertThat(log.getIngestDay()).isNotEmpty();
            assertThat(log.getHostname()).isNotEmpty();
        });
    }

    @Tag("monitor")
    @Test
    @DisplayName("Get log details")
    public void testGetLogDetails() {
        List<LogEvent> logs = LogsApi.getLogs();
        assertThat(logs).as("Expected at least one log to get details").isNotEmpty();
        LogEvent logEvent = logs.getFirst();
        LogDetails details = LogsApi.getLogDetails(logEvent);
        assertThat(details).isNotNull();
        assertThat(details.getToolEventId()).isEqualTo(logEvent.getToolEventId());
        assertThat(details.getEventType()).isEqualTo(logEvent.getEventType());
        assertThat(details.getToolType()).isEqualTo(logEvent.getToolType());
    }

    @Tag("monitor")
    @Test
    @DisplayName("Search logs")
    public void testSearchLogs() {
        List<LogEvent> logs = LogsApi.getLogs();
        assertThat(logs).as("Expected at least one log for search test").isNotEmpty();
        String searchTerm = logs.getFirst().getToolType();
        List<LogEvent> searchResults = LogsApi.searchLogs(searchTerm);
        assertThat(searchResults).as("Expected at least one search result").isNotEmpty();
        assertThat(searchResults).allSatisfy(log ->
                assertThat(log.getToolType()).isEqualTo(searchTerm)
        );
    }

    @Tag("monitor")
    @Test
    @DisplayName("Filter logs by severity and tool")
    public void testFilterLogs() {
        LogFilters filters = LogsApi.getLogFilters();
        assertThat(filters.getSeverities()).as("Expected at least one severity").isNotEmpty();
        assertThat(filters.getToolTypes()).as("Expected at least one tool type").isNotEmpty();
        String severity = filters.getSeverities().getFirst();
        String toolType = filters.getToolTypes().getFirst();
        List<LogEvent> logs = LogsApi.getLogs(LogGenerator.severityAndToolFilter(severity, toolType));
        assertThat(logs).as("Expected logs for severity: %s and tool: %s", severity, toolType).isNotEmpty();
        assertThat(logs).allSatisfy(log -> {
            assertThat(log.getSeverity()).isEqualTo(severity);
            assertThat(log.getToolType()).isEqualTo(toolType);
        });
    }
}
