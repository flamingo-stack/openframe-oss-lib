package com.openframe.data.loki.model;

import java.util.List;
import java.util.Map;

public record LokiPushRequest(List<Stream> streams) {

    public record Stream(Map<String, String> stream, List<List<Object>> values) {
    }

    public static LokiPushRequest ofSingleEntry(Map<String, String> labels, long timestampNanos, String line,
                                                Map<String, String> metadata) {
        List<Object> value = List.of(String.valueOf(timestampNanos), line, metadata);
        return new LokiPushRequest(List.of(new Stream(labels, List.of(value))));
    }
}
