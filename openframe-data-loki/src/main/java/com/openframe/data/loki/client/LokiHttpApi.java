package com.openframe.data.loki.client;

import com.openframe.data.loki.model.LokiQueryResponse;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.service.annotation.GetExchange;
import org.springframework.web.service.annotation.HttpExchange;

/**
 * Declarative binding of the Loki HTTP query API, limited to what OpenFrame reads.
 * Request parameters are sent as encoded URI variables, so LogQL braces, pipes and {@code +} survive intact.
 */
@HttpExchange("/loki/api/v1")
public interface LokiHttpApi {

    String ACTOR_HEADER = "X-Loki-Actor-Path";
    String QUERY_LIMITS_HEADER = "X-Loki-Query-Limits";

    /**
     * Timestamps are nanosecond Unix epochs: {@code start} is inclusive, {@code end} exclusive.
     * <p>
     * {@code actor} names the caller for Loki's query scheduler, which splits a query into hundreds of sub-queries
     * that all wait in one queue. Callers sharing an actor share a sub-queue and are served round-robin against the
     * other actors, so one caller's heavy query no longer holds up everyone else's small ones. A null actor sends no
     * header, which is the unfair single-queue behaviour.
     * <p>
     * {@code queryLimits} is a JSON object of Loki limits to apply to this request alone; it can only lower them.
     * Null sends no header.
     */
    @GetExchange("/query_range")
    LokiQueryResponse queryRange(@RequestParam("query") String query,
                                 @RequestParam("start") long startNanos,
                                 @RequestParam("end") long endNanos,
                                 @RequestParam("limit") int limit,
                                 @RequestParam("direction") String direction,
                                 @RequestHeader(name = ACTOR_HEADER, required = false) String actor,
                                 @RequestHeader(name = QUERY_LIMITS_HEADER, required = false) String queryLimits);
}
