package com.openframe.test.helpers;

import io.restassured.filter.Filter;
import io.restassured.filter.FilterContext;
import io.restassured.response.Response;
import io.restassured.specification.FilterableRequestSpecification;
import io.restassured.specification.FilterableResponseSpecification;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;

/**
 * Keeps the External API suite inside the gateway's per-key rate limit.
 *
 * <p>The limit observed on the QA key is <strong>5 requests/minute</strong> (hour 1000, day 10000).
 * A suite of this size issues far more than that, so without pacing every run collapses into
 * {@code 429 RATE_LIMIT_EXCEEDED} and the failures say nothing about the API.
 *
 * <p>Two mechanisms, in order of preference:
 * <ol>
 *   <li><b>Pacing</b> — requests are spaced to the advertised per-minute limit, read from the
 *       {@code X-RateLimit-Limit-Minute} response header, so the 429 is normally never provoked.</li>
 *   <li><b>Retry</b> — if one slips through anyway (a shared key, a partly-spent window at startup),
 *       the request waits out {@code Retry-After} and is re-driven.</li>
 * </ol>
 *
 * <p>Pacing state is static: the limit is enforced per API key at the gateway, so it must be shared
 * across every thread using that key, not per spec instance.
 *
 * <p>This cannot live in {@link RetryingHttpClientFactory} — Apache's {@code HttpRequestRetryHandler}
 * only sees transport <em>exceptions</em>, and a 429 is a perfectly good HTTP response.
 *
 * <p>Retrying a 429 is side-effect-free for any method, including non-idempotent ones: the gateway
 * rejects at its filter, before the request reaches the service, so nothing was applied.
 */
public class RateLimitRetryFilter implements Filter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitRetryFilter.class);

    private static final int TOO_MANY_REQUESTS = 429;
    private static final String RETRY_AFTER = "Retry-After";
    private static final String LIMIT_MINUTE = "X-RateLimit-Limit-Minute";
    private static final String REMAINING_MINUTE = "X-RateLimit-Remaining-Minute";
    private static final String REMAINING_HOUR = "X-RateLimit-Remaining-Hour";
    private static final String REMAINING_DAY = "X-RateLimit-Remaining-Day";

    private static final int MAX_ATTEMPTS = 4;
    private static final Duration DEFAULT_RETRY_AFTER = Duration.ofSeconds(60);
    /** Clock skew and window rounding mean waiting the exact Retry-After can still land in the old window. */
    private static final Duration GRACE = Duration.ofSeconds(2);
    /**
     * Spacing is (60s / limit) inflated by this factor, to stay clear of the fixed window's boundary.
     *
     * <p>Proportional rather than a flat pad on purpose. A flat margin sized for a 5/min limit (where
     * the interval is 12s and a few hundred ms is nothing) becomes the dominant term once the limit is
     * raised: at 300/min the interval is 200ms, and a 600ms pad would make every request 4x slower than
     * the limit requires, wasting most of the headroom the raise was meant to buy.
     */
    private static final double PACING_HEADROOM = 1.10;
    /** Floor, so an very high advertised limit cannot collapse spacing to a busy-loop. */
    private static final long MIN_SPACING_MILLIS = 10;

    /** Assumed until a response tells us otherwise — matches the QA key, and is safely low. */
    private static final int ASSUMED_LIMIT_PER_MINUTE = 5;

    private static final Object PACING_LOCK = new Object();
    private static volatile int limitPerMinute = ASSUMED_LIMIT_PER_MINUTE;
    private static long nextAllowedAtMillis = 0L;

    @Override
    public Response filter(FilterableRequestSpecification requestSpec,
                           FilterableResponseSpecification responseSpec,
                           FilterContext ctx) {
        Response response = send(ctx, requestSpec, responseSpec);
        if (response == null) {
            return noResponse(requestSpec);
        }

        for (int attempt = 1; attempt <= MAX_ATTEMPTS && response.getStatusCode() == TOO_MANY_REQUESTS; attempt++) {
            Duration wait = retryAfter(response).plus(GRACE);
            log.warn("429 on {} {} (attempt {}/{}); waiting {}s for the rate-limit window to reset",
                    requestSpec.getMethod(), requestSpec.getURI(), attempt, MAX_ATTEMPTS, wait.toSeconds());
            if (!sleep(wait)) {
                return response;
            }
            resetPacingWindow();
            response = send(ctx, requestSpec, responseSpec);
            if (response == null) {
                return noResponse(requestSpec);
            }
        }

        if (response.getStatusCode() == TOO_MANY_REQUESTS) {
            log.error("Still rate limited after {} attempts on {} {}. {}",
                    MAX_ATTEMPTS, requestSpec.getMethod(), requestSpec.getURI(), exhaustedWindow(response));
        }
        return response;
    }

    /**
     * Paces, sends, and adopts whatever limit the response advertises.
     *
     * <p>Returns {@code null} when the request produced no response at all. Every send goes through here
     * so that neither the initial attempt nor a retry can leave an unobserved or unchecked response
     * behind — the retry path being exactly what an earlier version of this filter missed.
     */
    private static Response send(FilterContext ctx, FilterableRequestSpecification requestSpec,
                                 FilterableResponseSpecification responseSpec) {
        awaitTurn();
        Response response = ctx.next(requestSpec, responseSpec);
        if (response != null) {
            observeLimit(response);
        }
        return response;
    }

    /**
     * RestAssured hands back {@code null} when a request never produced a response — in practice a
     * connect failure that outlived {@link RetryingHttpClientFactory}'s own attempts. Nothing here can
     * interpret that, and touching it would replace a legible {@code ConnectException} with an NPE
     * pointing at this filter, so it passes straight through.
     */
    private static Response noResponse(FilterableRequestSpecification requestSpec) {
        log.warn("No response for {} {}; passing it through untouched",
                requestSpec.getMethod(), requestSpec.getURI());
        return null;
    }

    /** Blocks until this request's slot in the per-minute budget is due. */
    private static void awaitTurn() {
        long waitMillis;
        synchronized (PACING_LOCK) {
            long now = System.currentTimeMillis();
            long spacing = spacingMillis();
            long dueAt = Math.max(now, nextAllowedAtMillis);
            nextAllowedAtMillis = dueAt + spacing;
            waitMillis = dueAt - now;
        }
        if (waitMillis > 0) {
            log.debug("Pacing External API call: waiting {}ms (limit {}/min)", waitMillis, limitPerMinute);
            sleep(Duration.ofMillis(waitMillis));
        }
    }

    private static long spacingMillis() {
        int limit = Math.max(1, limitPerMinute);
        long even = Duration.ofMinutes(1).toMillis() / limit;
        return Math.max(MIN_SPACING_MILLIS, (long) Math.ceil(even * PACING_HEADROOM));
    }

    /** After a 429 the window is spent; restart pacing from now rather than from the stale schedule. */
    private static void resetPacingWindow() {
        synchronized (PACING_LOCK) {
            nextAllowedAtMillis = System.currentTimeMillis();
        }
    }

    /** Adopt the gateway's advertised limit so pacing tracks the environment instead of a guess. */
    private static void observeLimit(Response response) {
        int advertised = intHeader(response, LIMIT_MINUTE);
        if (advertised > 0 && advertised != limitPerMinute) {
            limitPerMinute = advertised;
            // The next slot was already booked using the previous spacing. Left alone, a raised limit
            // would still serve out the old slow schedule for one request; re-basing applies the new
            // pace immediately.
            resetPacingWindow();
            log.info("External API rate limit is {}/min; pacing to {}ms between calls",
                    advertised, spacingMillis());
        }
        int remaining = intHeader(response, REMAINING_MINUTE);
        if (remaining == 0) {
            log.debug("Per-minute rate-limit budget is now spent; next call will be paced into the next window");
        }
    }

    private static int intHeader(Response response, String name) {
        String value = response.getHeader(name);
        if (value == null || value.isBlank()) {
            return -1;
        }
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException e) {
            return -1; // Header shape is the gateway's business; never fail a test over it.
        }
    }

    /**
     * Names the window that is actually out of budget, because the remedy differs per window and the
     * retry above can only help with one of them.
     *
     * <p>Retrying is only meaningful for the minute window: {@code Retry-After} is 60s, which clears a
     * one-minute window and does nothing at all for an hour or a day. Reporting "raise the per-minute
     * limit" when the hourly budget is what ran out would send the reader after the wrong dial.
     */
    private static String exhaustedWindow(Response response) {
        if (intHeader(response, REMAINING_DAY) == 0) {
            return "The key's DAILY budget is exhausted; retrying cannot help and the suite should not "
                    + "run again until the window rolls over.";
        }
        if (intHeader(response, REMAINING_HOUR) == 0) {
            return "The key's HOURLY budget is exhausted; Retry-After is 60s, which cannot clear an hour "
                    + "window, so this will not recover by retrying.";
        }
        return "The key's per-minute budget is too small for this suite — raise the limit rather than "
                + "widening the retry window.";
    }

    private static Duration retryAfter(Response response) {
        String header = response.getHeader(RETRY_AFTER);
        if (header != null && !header.isBlank()) {
            try {
                return Duration.ofSeconds(Long.parseLong(header.trim()));
            } catch (NumberFormatException e) {
                log.debug("Unparseable Retry-After '{}'; defaulting to {}s", header, DEFAULT_RETRY_AFTER.toSeconds());
            }
        }
        return DEFAULT_RETRY_AFTER;
    }

    private static boolean sleep(Duration duration) {
        try {
            Thread.sleep(duration.toMillis());
            return true;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }
}
