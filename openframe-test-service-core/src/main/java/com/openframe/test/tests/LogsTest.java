package com.openframe.test.tests;

import com.openframe.test.api.LogsApi;
import com.openframe.test.data.dto.log.LogDetails;
import com.openframe.test.data.dto.log.LogEvent;
import com.openframe.test.data.dto.log.LogFilters;
import com.openframe.test.data.generator.LogGenerator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static com.openframe.test.data.generator.LogGenerator.searchTerm;
import static com.openframe.test.data.generator.LogGenerator.timestampRangeFilter;
import static com.openframe.test.data.generator.LogGenerator.timestampSort;
import static org.assertj.core.api.Assertions.assertThat;

@Tag("saas")
@DisplayName("Logs")
public class LogsTest extends BaseTest {

    @Tag("read")
    @Test
    @DisplayName("Get log filters")
    public void testGetLogFilters() {
        LogFilters filters = LogsApi.getLogFilters();
        assertThat(filters).as("Log filters should not be null").isNotNull();
        assertThat(filters.getToolTypes()).as("Expected at least one tool type").isNotEmpty();
        assertThat(filters.getEventTypes()).as("Expected at least one event type").isNotEmpty();
        assertThat(filters.getSeverities()).as("Expected at least one severity").isNotEmpty();
    }

    @Tag("read")
    @Test
    @DisplayName("List logs")
    public void testListLogs() {
        List<LogEvent> logs = LogsApi.getLogs();
        assertThat(logs).as("Expected at least one log").isNotEmpty();
        assertThat(logs).allSatisfy(log -> {
            assertThat(log.getToolEventId()).as("Log toolEventId should not be null").isNotNull();
            assertThat(log.getEventType()).as("Log eventType should not be empty").isNotEmpty();
            assertThat(log.getToolType()).as("Log toolType should not be empty").isNotEmpty();
            assertThat(log.getTimestamp()).as("Log timestamp should not be empty").isNotEmpty();
            assertThat(log.getIngestDay()).as("Log ingestDay should not be empty").isNotEmpty();
            assertThat(log.getHostname()).as("Log hostname should not be empty").isNotEmpty();
        });
    }

    @Tag("read")
    @Test
    @DisplayName("Get log details")
    public void testGetLogDetails() {
        List<LogEvent> logs = LogsApi.getLogs();
        assertThat(logs).as("Expected at least one log to get details").isNotEmpty();
        LogEvent logEvent = logs.getFirst();
        LogDetails details = LogsApi.getLogDetails(logEvent);
        assertThat(details).as("Log details should not be null").isNotNull();
        assertThat(details.getToolEventId()).as("Log details toolEventId should match").isEqualTo(logEvent.getToolEventId());
        assertThat(details.getEventType()).as("Log details eventType should match").isEqualTo(logEvent.getEventType());
        assertThat(details.getToolType()).as("Log details toolType should match").isEqualTo(logEvent.getToolType());
    }

    @Tag("read")
    @Test
    @DisplayName("Search logs")
    public void testSearchLogs() {
        List<LogEvent> logs = LogsApi.getLogs();
        assertThat(logs).as("Expected at least one log for search test").isNotEmpty();
        String searchWord = searchTerm(logs.getFirst().getSummary());
        List<LogEvent> searchResults = LogsApi.searchLogs(searchWord);
        assertThat(searchResults).as("Expected at least one search result for: " + searchWord).isNotEmpty();
        assertThat(searchResults.getFirst().getSummary()).as("Search result summary should contain " + searchWord).contains(searchWord);
    }

    @Tag("read")
    @Test
    @DisplayName("Filter logs by severity")
    public void testFilterLogs() {
        LogFilters filters = LogsApi.getLogFilters();
        assertThat(filters.getSeverities()).as("Expected at least one severity").isNotEmpty();
        String severity = filters.getSeverities().getFirst();
        List<LogEvent> logs = LogsApi.getLogs(LogGenerator.severityFilter(severity));
        assertThat(logs).as("Expected logs for severity: %s", severity).isNotEmpty();
        assertThat(logs).allSatisfy(log -> {
            assertThat(log.getSeverity()).as("Log severity should match filter").isEqualTo(severity);
        });
    }

    @Tag("read")
    @Test
    @DisplayName("Sort logs by timestamp ascending")
    public void testSortLogsByTimestampAscending() {
        List<Instant> timestamps = LogsApi.getLogsTimestamps(timestampSort("ASC"));
        assertThat(timestamps).as("Expected at least one log for ascending sort").isNotEmpty();
        assertThat(timestamps).as("Logs should be sorted by timestamp oldest-first").isSorted();
    }

    @Tag("read")
    @Test
    @DisplayName("Filter logs by timestamp range")
    public void testFilterLogsByTimestampRange() {
        List<Instant> ordered = LogsApi.getLogsTimestamps(timestampSort("ASC"));
        assertThat(ordered).as("Expected at least one log for timestamp range test").isNotEmpty();
        Instant from = ordered.getFirst();
        Instant to = ordered.getLast();

        List<Instant> timestamps = LogsApi.getLogsTimestamps(timestampRangeFilter(from.toString(), to.toString()));
        assertThat(timestamps).as("Expected logs within range [%s, %s]", from, to).isNotEmpty();
        assertThat(timestamps).allSatisfy(timestamp ->
                assertThat(timestamp).as("Log timestamp should be within the inclusive range")
                        .isBetween(from, to));
    }
}
