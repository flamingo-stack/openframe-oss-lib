package com.openframe.data.loki.toolevent;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;
import com.openframe.data.loki.client.LogQl;
import com.openframe.data.loki.client.LokiClient;
import com.openframe.data.loki.client.LokiQueryException;
import com.openframe.data.loki.client.LokiQueryRejectedException;
import com.openframe.data.loki.model.LokiDirection;
import com.openframe.data.loki.model.LokiLogEntry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;

import static java.nio.charset.StandardCharsets.UTF_8;

@Slf4j
@RequiredArgsConstructor
public class ToolEventLogRepository {

    private static final String JOB = "tool-events";
    private static final long NANOS_PER_MILLI = 1_000_000L;
    private static final int LOKI_LINE_LIMIT_BYTES = 256 * 1024;
    private static final int PARTS_PER_READ = 4;
    private static final ObjectMapper MAPPER = new JsonMapper();

    private final LokiClient lokiClient;

    public void save(ToolEventLog event) {
        Map<String, String> labels = Map.of(
                "job", JOB,
                "tenant_id", event.getTenantId(),
                "tool_type", event.getToolType());
        long eventNanos = event.getEventTimestamp() * NANOS_PER_MILLI;
        List<String> parts = parts(toLine(event));
        for (int part = 0; part < parts.size(); part++) {
            lokiClient.push(labels, eventNanos + part, parts.get(part), metadata(event, part, parts.size()));
        }
    }

    public Optional<ToolEventLog> find(String tenantId, String toolType, Instant timestamp, String toolEventId) {
        String query = "{job=%s, tenant_id=%s, tool_type=%s} | tool_event_id=%s".formatted(
                LogQl.quote(JOB), LogQl.quote(tenantId), LogQl.quote(toolType), LogQl.quote(toolEventId));
        List<LokiLogEntry> page = queryRange(query, timestamp.toEpochMilli() * NANOS_PER_MILLI - 1, tenantId);
        if (page.isEmpty()) {
            return Optional.empty();
        }
        int partCount = partCount(page.getFirst());
        Map<Integer, String> parts = new TreeMap<>();
        collect(page, parts);
        while (parts.size() < partCount && page.size() == PARTS_PER_READ) {
            page = queryRange(query, page.getLast().timestampNanos(), tenantId);
            collect(page, parts);
        }
        if (parts.size() != partCount) {
            log.warn("Tool event log in Loki is incomplete, {} of {} parts: tenantId={}, toolType={}, "
                            + "toolEventId={}, eventTimestamp={}",
                    parts.size(), partCount, tenantId, toolType, toolEventId, timestamp.toEpochMilli());
            return Optional.empty();
        }
        return Optional.of(fromLine(String.join("", parts.values())));
    }

    private List<LokiLogEntry> queryRange(String query, long startNanos, String tenantId) {
        try {
            return lokiClient.queryRange(query, startNanos, startNanos + 1 + PARTS_PER_READ, PARTS_PER_READ,
                    LokiDirection.FORWARD, tenantId);
        } catch (LokiQueryRejectedException e) {
            throw new LokiQueryException(e.getMessage(), e);
        }
    }

    String toLine(ToolEventLog event) {
        try {
            return MAPPER.writeValueAsString(event);
        } catch (JacksonException e) {
            throw new IllegalStateException("Tool event log cannot be written as a Loki line", e);
        }
    }

    private static List<String> parts(String line) {
        byte[] bytes = line.getBytes(UTF_8);
        if (bytes.length <= LOKI_LINE_LIMIT_BYTES) {
            return List.of(line);
        }
        List<String> parts = new ArrayList<>();
        int start = 0;
        while (start < bytes.length) {
            int end = Math.min(start + LOKI_LINE_LIMIT_BYTES, bytes.length);
            while (end < bytes.length && (bytes[end] & 0xC0) == 0x80) {
                end--;
            }
            parts.add(new String(bytes, start, end - start, UTF_8));
            start = end;
        }
        return parts;
    }

    private static Map<String, String> metadata(ToolEventLog event, int part, int parts) {
        String toolEventId = event.getToolEventId();
        return parts == 1
                ? Map.of("tool_event_id", toolEventId)
                : Map.of("tool_event_id", toolEventId, "part", String.valueOf(part), "parts", String.valueOf(parts));
    }

    /**
     * Gathers the pieces of the event from one batch of records that Loki returned.
     */
    private static void collect(List<LokiLogEntry> page, Map<Integer, String> parts) {
        for (LokiLogEntry entry : page) {
            parts.putIfAbsent(partIndex(entry), entry.line());
        }
    }

    /**
     * How many pieces the event was saved in
     */
    private static int partCount(LokiLogEntry entry) {
        String parts = entry.labels().get("parts");
        return parts == null ? 1 : Integer.parseInt(parts);
    }

    /**
     * Which piece of the event this Loki record is, counted from 0
     */
    private static int partIndex(LokiLogEntry entry) {
        String part = entry.labels().get("part");
        return part == null ? 0 : Integer.parseInt(part);
    }

    private static ToolEventLog fromLine(String line) {
        try {
            return MAPPER.readValue(line, ToolEventLog.class);
        } catch (JacksonException e) {
            throw new LokiQueryException("Tool event log line in Loki is not readable", e);
        }
    }
}
