package com.openframe.data.loki.client;

import com.openframe.data.loki.model.LokiDirection;
import com.openframe.data.loki.model.LokiLogEntry;
import com.openframe.data.loki.model.LokiPushRequest;
import com.openframe.data.loki.model.LokiQueryResponse;
import org.springframework.http.HttpStatus;
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

    /** Pre-rendered X-Loki-Query-Limits payload, or null to send no header. */
    private final String queryLimits;

    public LokiClient(RestClient restClient) {
        this(restClient, null);
    }

    /**
     * {@code maxQueryBytesRead} caps the bytes one query may read, e.g. {@code 5GB}; blank sends no header.
     */
    public LokiClient(RestClient restClient, String maxQueryBytesRead) {
        this.api = HttpServiceProxyFactory.builderFor(RestClientAdapter.create(restClient))
                .build()
                .createClient(LokiHttpApi.class);
        this.queryLimits = maxQueryBytesRead == null || maxQueryBytesRead.isBlank()
                ? null
                : "{\"maxQueryBytesRead\":\"" + maxQueryBytesRead.trim() + "\"}";
    }

    /**
     * Runs a LogQL log query over {@code [startNanos, endNanos)} and returns up to {@code limit} entries merged
     * across streams: newest first for {@link LokiDirection#BACKWARD}, oldest first for
     * {@link LokiDirection#FORWARD}. Entries sharing a timestamp are ordered by labels and line, so repeating
     * a query returns them in the same order.
     */
    public List<LokiLogEntry> queryRange(String query, long startNanos, long endNanos, int limit,
                                         LokiDirection direction) {
        return queryRange(query, startNanos, endNanos, limit, direction, null);
    }

    /**
     * As {@link #queryRange(String, long, long, int, LokiDirection)}, but declares {@code actor} so Loki's scheduler
     * gives this caller its own sub-queue instead of queueing it behind everyone else. The actor is a fairness hint
     * only: it never changes which entries a query returns, and Loki ignores it when hierarchical queues are off.
     */
    public List<LokiLogEntry> queryRange(String query, long startNanos, long endNanos, int limit,
                                         LokiDirection direction, String actor) {
        LokiQueryResponse response;
        try {
            response = api.queryRange(query, startNanos, endNanos, limit, direction.name().toLowerCase(Locale.ROOT),
                    actor, queryLimits);
        } catch (RestClientResponseException e) {
            throw translate(e);
        } catch (RestClientException e) {
            throw new LokiQueryException("Loki query failed: " + e.getMessage(), e);
        }
        return toEntries(response, direction);
    }

    public void push(Map<String, String> labels, long timestampNanos, String line, Map<String, String> metadata) {
        try {
            api.push(LokiPushRequest.ofSingleEntry(labels, timestampNanos, line, metadata));
        } catch (RestClientResponseException e) {
            throw translatePush(e);
        } catch (RestClientException e) {
            throw new LokiPushException("Loki push failed: " + e.getMessage(), e);
        }
    }

    private static LokiPushException translatePush(RestClientResponseException e) {
        String message = failureMessage("push", e);
        return e.getStatusCode().isSameCodeAs(HttpStatus.BAD_REQUEST)
                ? new LokiPushRejectedException(message, e)
                : new LokiPushException(message, e);
    }

    /**
     * A 4xx means Loki rejected the request rather than failed on it: over a limit, or - our bug - malformed LogQL.
     * Either way the caller should not retry it unchanged, which a 5xx would invite.
     */
    private static LokiQueryException translate(RestClientResponseException e) {
        String message = failureMessage("query", e);
        if (e.getStatusCode().is4xxClientError()) {
            return new LokiQueryRejectedException(message, e);
        }
        return new LokiQueryException(message, e);
    }

    private static String failureMessage(String action, RestClientResponseException e) {
        return "Loki " + action + " failed with HTTP " + e.getStatusCode().value() + ": "
                + abbreviate(e.getResponseBodyAsString());
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
