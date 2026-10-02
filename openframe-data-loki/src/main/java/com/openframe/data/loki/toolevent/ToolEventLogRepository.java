package com.openframe.data.loki.toolevent;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.loki.client.LogQl;
import com.openframe.data.loki.client.LokiClient;
import com.openframe.data.loki.client.LokiQueryException;
import com.openframe.data.loki.client.LokiQueryRejectedException;
import com.openframe.data.loki.model.LokiDirection;
import com.openframe.data.loki.model.LokiLogEntry;
import lombok.RequiredArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RequiredArgsConstructor
public class ToolEventLogRepository {

    private static final String JOB = "tool-events";
    private static final long NANOS_PER_MILLI = 1_000_000L;
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final LokiClient lokiClient;

    public void save(ToolEventLog event) {
        Map<String, String> labels = Map.of(
                "job", JOB,
                "tenant_id", event.getTenantId(),
                "tool_type", event.getToolType());
        Map<String, String> metadata = Map.of(
                "tool_event_id", event.getToolEventId(),
                "event_type", event.getEventType());
        lokiClient.push(labels, event.getEventTimestamp() * NANOS_PER_MILLI, toLine(event), metadata);
    }

    public Optional<ToolEventLog> find(String tenantId, String toolType, String eventType, Instant timestamp,
                                       String toolEventId) {
        String query = "{job=%s, tenant_id=%s, tool_type=%s} | tool_event_id=%s | event_type=%s".formatted(
                LogQl.quote(JOB), LogQl.quote(tenantId), LogQl.quote(toolType), LogQl.quote(toolEventId),
                LogQl.quote(eventType));
        long startNanos = timestamp.toEpochMilli() * NANOS_PER_MILLI;
        return queryRange(query, startNanos, tenantId).stream().findFirst().map(entry -> fromLine(entry.line()));
    }

    private List<LokiLogEntry> queryRange(String query, long startNanos, String tenantId) {
        try {
            return lokiClient.queryRange(query, startNanos, startNanos + NANOS_PER_MILLI, 1, LokiDirection.BACKWARD,
                    tenantId);
        } catch (LokiQueryRejectedException e) {
            throw new LokiQueryException(e.getMessage(), e);
        }
    }

    public String toLine(ToolEventLog event) {
        try {
            return MAPPER.writeValueAsString(event);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Tool event log cannot be written as a Loki line", e);
        }
    }

    private static ToolEventLog fromLine(String line) {
        try {
            return MAPPER.readValue(line, ToolEventLog.class);
        } catch (JsonProcessingException e) {
            throw new LokiQueryException("Tool event log line in Loki is not readable", e);
        }
    }
}
