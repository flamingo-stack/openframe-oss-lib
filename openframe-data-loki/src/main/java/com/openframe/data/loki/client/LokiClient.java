package com.openframe.data.loki.client;

import com.openframe.data.loki.model.LokiDirection;
import com.openframe.data.loki.model.LokiLogEntry;
import com.openframe.data.loki.model.LokiQueryResponse;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.support.RestClientAdapter;
import org.springframework.web.service.invoker.HttpServiceProxyFactory;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.SortedMap;
import java.util.TreeMap;

public class LokiClient {

    private static final String STREAMS_RESULT_TYPE = "streams";
    private static final int MAX_ERROR_BODY_LENGTH = 500;

    private final LokiHttpApi api;

    public LokiClient(RestClient restClient) {
        this.api = HttpServiceProxyFactory.builderFor(RestClientAdapter.create(restClient))
                .build()
                .createClient(LokiHttpApi.class);
    }

    /**
     * Runs a LogQL log query over {@code [startNanos, endNanos)} and returns up to {@code limit} entries merged
     * across streams: newest first for {@link LokiDirection#BACKWARD}, oldest first for
     * {@link LokiDirection#FORWARD}. Entries sharing a timestamp are ordered by labels and line, so repeating
     * a query returns them in the same order.
     */
    public List<LokiLogEntry> queryRange(String query, long startNanos, long endNanos, int limit,
                                         LokiDirection direction) {
        LokiQueryResponse response;
        try {
            response = api.queryRange(query, startNanos, endNanos, limit, direction.name().toLowerCase(Locale.ROOT));
        } catch (RestClientResponseException e) {
            String body = abbreviate(e.getResponseBodyAsString());
            throw new LokiQueryException("Loki query failed with HTTP " + e.getStatusCode().value() + ": " + body, e);
        } catch (RestClientException e) {
            throw new LokiQueryException("Loki query failed: " + e.getMessage(), e);
        }
        return toEntries(response, direction);
    }

    private static List<LokiLogEntry> toEntries(LokiQueryResponse response, LokiDirection direction) {
        if (response == null || response.data() == null || response.data().result() == null) {
            return List.of();
        }
        if (!STREAMS_RESULT_TYPE.equals(response.data().resultType())) {
            throw new LokiQueryException("Expected a log query result, got: " + response.data().resultType());
        }

        List<LokiLogEntry> entries = new ArrayList<>();
        for (LokiQueryResponse.LogStream stream : response.data().result()) {
            if (stream.values() == null) {
                continue;
            }
            // Sorted, so equal-timestamp ordering below does not depend on JSON key order
            SortedMap<String, String> labels = Collections.unmodifiableSortedMap(
                    new TreeMap<>(stream.stream() != null ? stream.stream() : Map.of()));
            for (List<String> value : stream.values()) {
                if (value != null && value.size() >= 2) {
                    long timestampNanos = Long.parseLong(value.get(0));
                    entries.add(new LokiLogEntry(timestampNanos, value.get(1), labels));
                }
            }
        }

        Comparator<LokiLogEntry> byTimestamp = Comparator.comparingLong(LokiLogEntry::timestampNanos);
        entries.sort((direction == LokiDirection.BACKWARD ? byTimestamp.reversed() : byTimestamp)
                .thenComparing(entry -> entry.labels().toString())
                .thenComparing(LokiLogEntry::line));
        return entries;
    }

    private static String abbreviate(String body) {
        if (body == null) {
            return "";
        }
        return body.length() <= MAX_ERROR_BODY_LENGTH ? body : body.substring(0, MAX_ERROR_BODY_LENGTH) + "...";
    }
}
