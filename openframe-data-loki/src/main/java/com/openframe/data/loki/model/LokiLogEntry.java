package com.openframe.data.loki.model;

import java.time.Instant;
import java.util.Map;

/**
 * A log line with its stream labels and structured metadata merged into {@code labels}.
 */
public record LokiLogEntry(long timestampNanos, String line, Map<String, String> labels) {

    public Instant timestamp() {
        return Instant.ofEpochSecond(0, timestampNanos);
    }
}
