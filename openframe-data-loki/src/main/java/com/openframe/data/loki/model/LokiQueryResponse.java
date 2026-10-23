package com.openframe.data.loki.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
public record LokiQueryResponse(String status, QueryData data) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record QueryData(String resultType, List<LogStream> result) {
    }

    /**
     * One log stream. Without the categorize-labels encoding flag Loki folds structured metadata into
     * {@code stream}, so each distinct metadata set arrives as its own stream. Each value is a
     * {@code [timestampNanos, line]} pair.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record LogStream(Map<String, String> stream, List<List<String>> values) {
    }
}
