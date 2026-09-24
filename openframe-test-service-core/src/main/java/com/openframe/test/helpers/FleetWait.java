package com.openframe.test.helpers;

import lombok.extern.slf4j.Slf4j;

import java.util.function.Predicate;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;

// Polls because Fleet's triggers are async (refetch on next check-in, policy aggregates via cron); a
// failed poll is treated as "not yet" since an isolated non-200 from the Fleet proxy has been observed
// on qa and isn't covered by RetryingHttpClientFactory's connection-failure-only retries.
@Slf4j
public class FleetWait {

    public static final int DEFAULT_TIMEOUT_SECONDS = 180;
    private static final long POLL_INTERVAL_MS = 3000;

    public static <T> T until(String what, Supplier<T> read, Predicate<T> satisfied) {
        return until(what, read, satisfied, DEFAULT_TIMEOUT_SECONDS);
    }

    // Returns the last value successfully read regardless of whether it satisfied the condition, so the
    // caller can assert on it and produce a domain-specific failure message.
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
