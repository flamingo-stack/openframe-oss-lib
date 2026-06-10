package com.openframe.test.helpers;

import io.restassured.config.HttpClientConfig;
import org.apache.http.client.HttpClient;
import org.apache.http.conn.ConnectTimeoutException;
import org.apache.http.impl.client.SystemDefaultHttpClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.ConnectException;
import java.time.Duration;

/**
 * Builds the Apache HttpClient configuration RestAssured uses, with a retry handler that retries
 * only connection-establishment failures.
 */
class RetryingHttpClientFactory {

    // Connect fails fast so a dropped SYN (hairpin blip) is retried promptly instead of hanging;
    // socket timeout stays generous because the server itself can be slow to respond.
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(10);
    private static final Duration SOCKET_TIMEOUT = Duration.ofSeconds(32);
    // The test runner reaches the gateway by hairpinning out to the cluster's own external LB VIP,
    // which drops SYNs in intermittent bursts. 5 attempts (initial + 4 retries) plus backoff spans
    // ~50s+ of wall-clock so a single blip is ridden out instead of failing the test.
    private static final int CONNECT_RETRIES = 4;
    private static final Duration RETRY_BACKOFF_BASE = Duration.ofMillis(500);
    private static final Duration RETRY_BACKOFF_MAX = Duration.ofSeconds(5);
    private static final Logger log = LoggerFactory.getLogger(RetryingHttpClientFactory.class);

    private RetryingHttpClientFactory() {
    }

    static HttpClientConfig config() {
        return HttpClientConfig.httpClientConfig()
                .httpClientFactory(RetryingHttpClientFactory::createRetryingHttpClient)
                .setParam("http.connection.timeout", (int) CONNECT_TIMEOUT.toMillis())
                .setParam("http.socket.timeout", (int) SOCKET_TIMEOUT.toMillis());
    }

    /**
     * Apache HttpClient (RestAssured 5.x still drives the 4.x client) with a retry handler that retries
     * only connection-establishment failures. A connect failure means the request never reached the
     * server, so re-sending is side-effect-free even for non-idempotent mutations — unlike a read
     * timeout after the request was sent, which we deliberately do not retry.
     */
    @SuppressWarnings("deprecation") // SystemDefaultHttpClient is the client RestAssured itself defaults to
    private static HttpClient createRetryingHttpClient() {
        SystemDefaultHttpClient client = new SystemDefaultHttpClient();
        client.setHttpRequestRetryHandler((exception, executionCount, context) -> {
            // ConnectException also covers HttpHostConnectException (connection refused).
            boolean connectFailure = exception instanceof ConnectTimeoutException
                    || exception instanceof ConnectException;
            if (connectFailure && executionCount <= CONNECT_RETRIES) {
                Duration backoff = backoffFor(executionCount);
                log.warn("Connect attempt {} failed ({}); retrying after {}ms", executionCount,
                        exception.getClass().getSimpleName(), backoff.toMillis());
                return sleep(backoff);
            }
            return false;
        });
        return client;
    }

    /** Exponential backoff (capped) so the retries span a wider window than back-to-back connect timeouts. */
    private static Duration backoffFor(int executionCount) {
        long millis = RETRY_BACKOFF_BASE.toMillis() << (executionCount - 1); // base * 2^(executionCount-1)
        return Duration.ofMillis(Math.min(millis, RETRY_BACKOFF_MAX.toMillis()));
    }

    /** Sleep before the next connect attempt; abort retries (return false) if the thread is interrupted. */
    private static boolean sleep(Duration backoff) {
        try {
            Thread.sleep(backoff.toMillis());
            return true;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }
}
