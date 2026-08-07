package com.openframe.test.helpers;

import lombok.extern.slf4j.Slf4j;

import java.util.function.Predicate;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Polls a Fleet read until a condition holds.
 *
 * <p>Fleet's triggers are asynchronous: a host refetch is only applied on the host's next check-in, and
 * policy pass/fail aggregates are recomputed by a cron. Tests therefore observe the effect by polling
 * rather than asserting inline.
 *
 * <p><b>A failed poll counts as "not yet" rather than ending the wait.</b> An isolated non-200 from the
 * Fleet proxy between two healthy polls has been observed on qa, and {@link RetryingHttpClientFactory}
 * does not cover it — it retries connection failures, not error statuses. Without this, a single blip
 * anywhere in the wait would fail an otherwise good run.
 */
@Slf4j
public class FleetWait {

    public static final int DEFAULT_TIMEOUT_SECONDS = 180;
    private static final long POLL_INTERVAL_MS = 3000;

    public static <T> T until(String what, Supplier<T> read, Predicate<T> satisfied) {
        return until(what, read, satisfied, DEFAULT_TIMEOUT_SECONDS);
    }

    /**
     * Polls {@code read} until {@code satisfied} holds or the deadline passes.
     *
     * @return the last value successfully read — whether or not it satisfied the condition, so the
     * caller can assert on it and produce a domain-specific failure message.
     */
    public static <T> T until(String what, Supplier<T> read, Predicate<T> satisfied, int timeoutSeconds) {
        long deadline = System.nanoTime() + timeoutSeconds * 1_000_000_000L;
        T last = null;
        while (true) {
            T polled = null;
            boolean done = false;
            try {
                polled = read.get();
                done = satisfied.test(polled);
            } catch (AssertionError | RuntimeException e) {
                log.warn("Poll failed while waiting for {}, retrying: {}", what, e.getMessage());
            }
            if (polled != null) {
                last = polled;
            }
            if (done) {
                return polled;
            }
            if (System.nanoTime() >= deadline) {
                assertThat(last)
                        .as("Waiting for %s: Fleet never returned a readable response in %ds",
                                what, timeoutSeconds)
                        .isNotNull();
                return last;
            }
            sleep(what);
        }
    }

    private static void sleep(String what) {
        try {
            Thread.sleep(POLL_INTERVAL_MS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while waiting for " + what, e);
        }
    }
}
