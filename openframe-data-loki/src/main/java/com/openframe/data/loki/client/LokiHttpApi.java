package com.openframe.data.loki.client;

import com.openframe.data.loki.model.LokiQueryResponse;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.service.annotation.GetExchange;
import org.springframework.web.service.annotation.HttpExchange;

/**
 * Declarative binding of the Loki HTTP query API, limited to what OpenFrame reads.
 * Request parameters are sent as encoded URI variables, so LogQL braces, pipes and {@code +} survive intact.
 */
@HttpExchange("/loki/api/v1")
public interface LokiHttpApi {

    /**
     * Timestamps are nanosecond Unix epochs: {@code start} is inclusive, {@code end} exclusive.
     */
    @GetExchange("/query_range")
    LokiQueryResponse queryRange(@RequestParam("query") String query,
                                 @RequestParam("start") long startNanos,
                                 @RequestParam("end") long endNanos,
                                 @RequestParam("limit") int limit,
                                 @RequestParam("direction") String direction);
}
