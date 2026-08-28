package com.openframe.test.helpers;

import io.restassured.filter.Filter;
import io.restassured.filter.FilterContext;
import io.restassured.response.Response;
import io.restassured.specification.FilterableRequestSpecification;
import io.restassured.specification.FilterableResponseSpecification;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.util.Set;

/**
 * Rides out transient {@code 502} / {@code 504} responses from the gateway.
 *
 * <p>{@link RetryingHttpClientFactory} already retries connect failures, for a documented reason: the
 * runner reaches the gateway by hairpinning out to the cluster's external LB VIP, which drops traffic in
 * intermittent bursts. When that blip lands slightly later in the request it surfaces as a gateway 502
 * rather than a connect timeout — the same infrastructure hiccup, a different symptom, and one the
 * connect-retry handler cannot see because it only observes transport exceptions.
 *
 * <p>Deliberately narrow on two axes:
 * <ul>
 *   <li><b>Status.</b> Only {@code 502} and {@code 504}, which no OpenFrame service returns
 *       deliberately. {@code 503} is excluded even though it looks similar: the External API uses it
 *       semantically for {@code PINOT_QUERY_ERROR} and {@code DATABASE_ERROR}, and retrying those would
 *       paper over a genuine backend outage.</li>
 *   <li><b>Method.</b> Only idempotent ones. A 502 gives no evidence about whether the request reached
 *       the service, so re-sending a {@code POST} could create a second record; re-sending a
 *       {@code GET}, {@code PUT}, or {@code DELETE} cannot change the outcome.</li>
 * </ul>
 */
public class TransientGatewayRetryFilter implements Filter {

    private static final Logger log = LoggerFactory.getLogger(TransientGatewayRetryFilter.class);

    private static final Set<Integer> TRANSIENT_STATUSES = Set.of(502, 504);
    /** PATCH is omitted: the verb carries no idempotency guarantee, even where a given payload happens to. */
    private static final Set<String> IDEMPOTENT_METHODS = Set.of("GET", "HEAD", "OPTIONS", "PUT", "DELETE");

    private static final int MAX_RETRIES = 2;
    private static final Duration BACKOFF = Duration.ofSeconds(3);

    @Override
    public Response filter(FilterableRequestSpecification requestSpec,
                           FilterableResponseSpecification responseSpec,
                           FilterContext ctx) {
        Response response = ctx.next(requestSpec, responseSpec);
        if (response == null) {
            // No response at all (a connect failure that outlived the client's own retries). There is no
            // status code to inspect, and an NPE raised here would mask the real cause.
            return null;
        }

        String method = requestSpec.getMethod();
        if (!IDEMPOTENT_METHODS.contains(method)) {
            return response;
        }

        for (int attempt = 1; attempt <= MAX_RETRIES && TRANSIENT_STATUSES.contains(response.getStatusCode()); attempt++) {
            log.warn("{} from {} {} (attempt {}/{}); treating as a gateway blip and retrying after {}s",
                    response.getStatusCode(), method, requestSpec.getURI(), attempt, MAX_RETRIES,
                    BACKOFF.toSeconds());
            if (!sleep()) {
                return response;
            }
            response = ctx.next(requestSpec, responseSpec);
        }
        return response;
    }

    private static boolean sleep() {
        try {
            Thread.sleep(BACKOFF.toMillis());
            return true;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }
}
