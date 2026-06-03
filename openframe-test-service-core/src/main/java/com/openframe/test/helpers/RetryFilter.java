package com.openframe.test.helpers;

import io.restassured.filter.Filter;
import io.restassured.filter.FilterContext;
import io.restassured.response.Response;
import io.restassured.specification.FilterableRequestSpecification;
import io.restassured.specification.FilterableResponseSpecification;
import lombok.extern.slf4j.Slf4j;

import java.net.ConnectException;
import java.net.SocketException;
import java.net.SocketTimeoutException;

/**
 * Retries a request when it fails to reach the server (connection-establishment failures only).
 *
 * <p>The test pod talks to the public ingress over a hairpin route; the SYN is occasionally dropped,
 * surfacing as an {@link org.apache.http.conn.ConnectTimeoutException} after the connect timeout. Apache
 * HttpClient 4's default retry handler treats that (an {@link java.io.InterruptedIOException}) as
 * non-retriable, so a single blip fails the test. A connect failure means the request never reached the
 * server, so no work was done server-side and re-sending is side-effect-free — safe even for mutating
 * tests. Socket-read timeouts mid-response are intentionally NOT retried here, since the server may have
 * already applied the change.
 */
@Slf4j
public class RetryFilter implements Filter {

    private final int maxRetries;
    private final long baseBackoffMillis;

    public RetryFilter(int maxRetries) {
        this(maxRetries, 500);
    }

    public RetryFilter(int maxRetries, long baseBackoffMillis) {
        this.maxRetries = maxRetries;
        this.baseBackoffMillis = baseBackoffMillis;
    }

    @Override
    public Response filter(FilterableRequestSpecification requestSpec,
                           FilterableResponseSpecification responseSpec,
                           FilterContext ctx) {
        RuntimeException last = null;
        for (int attempt = 1; attempt <= maxRetries + 1; attempt++) {
            try {
                // ctx's filter iterator is exhausted after the first call, so each retry goes
                // straight to the actual send rather than re-running the filter chain.
                return ctx.next(requestSpec, responseSpec);
            } catch (RuntimeException e) {
                if (attempt > maxRetries || !isConnectionError(e)) {
                    throw e;
                }
                last = e;
                log.warn("Connection to {} failed (attempt {}/{}): {} — retrying",
                        requestSpec.getURI(), attempt, maxRetries, rootCause(e).toString());
                sleep(baseBackoffMillis * attempt);
            }
        }
        throw last;
    }

    /** True only for failures to establish the connection — i.e. the request never reached the server. */
    private static boolean isConnectionError(Throwable t) {
        for (Throwable c = t; c != null; c = c.getCause()) {
            if (c instanceof org.apache.http.conn.ConnectTimeoutException
                    || c instanceof ConnectException
                    || c instanceof org.apache.http.NoHttpResponseException) {
                return true;
            }
            // A SocketTimeoutException is a connect timeout only while still establishing the socket;
            // HttpClient wraps read timeouts as SocketTimeoutException too, so restrict to the
            // ConnectTimeoutException subtype above and treat a bare SocketException (e.g. connection
            // reset before any response) as retriable.
            if (c instanceof SocketException && !(c instanceof SocketTimeoutException)) {
                return true;
            }
            if (c.getCause() == c) {
                break;
            }
        }
        return false;
    }

    private static Throwable rootCause(Throwable t) {
        Throwable c = t;
        while (c.getCause() != null && c.getCause() != c) {
            c = c.getCause();
        }
        return c;
    }

    private static void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Interrupted while backing off before retry", ie);
        }
    }
}
