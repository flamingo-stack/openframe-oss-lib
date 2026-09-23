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

    // Measured from the saas-test pod on qa, 2026-09-22: connects to the gateway VIP that succeed do so
    // in 0.9ms median (p95 5ms), but roughly one in ten is lost on the egress path. A lost SYN is then
    // retransmitted by the kernel at 1s, 3s, 7s, 15s — so a stalled connect is never "slow", it is
    // waiting on a retransmit, and the only question is how long we wait before giving up and dialling
    // again. At 10s that cost 42 connect timeouts 210 of the 333 seconds in one run.
    //
    // 2s was tried and reverted. It made each drop cheap, but the timeout is also what sets how long a
    // request can ride out a burst: 5 attempts x 2s + backoff spans ~17.5s against ~57.5s at 10s. On the
    // qa dev suite of 2026-09-22 21:00 the drop rate tripled (67 failed attempts against 21 earlier that
    // evening), bursts outlasted the shorter budget, and two cases failed outright with
    // ConnectTimeoutException after exhausting their retries. Wall clock barely moved either — 333s to
    // 306s — because three times the drops ate the saving.
    //
    // If this is revisited, raise CONNECT_RETRIES alongside it rather than alone: 2s with 8 retries spans
    // ~45s, close to today's resilience, while still costing 2s per drop instead of 10.
    //
    // Socket timeout stays generous: that one covers the server thinking, which is a different problem.
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(10);
    private static final Duration SOCKET_TIMEOUT = Duration.ofSeconds(32);
    // 5 attempts (initial + 4 retries) plus backoff, spanning ~57.5s of wall clock, so a burst of drops
    // is ridden out rather than failing the test.
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
