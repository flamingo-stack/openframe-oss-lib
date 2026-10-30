package com.openframe.api.service.rmm.fleet;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

class FleetCallsTest {

    @Test
    void inParallel_moreCallsThanTheCap_neverMoreInFlightAndResultsKeepKeyOrder() {
        // setup
        AtomicInteger inFlight = new AtomicInteger();
        AtomicInteger peak = new AtomicInteger();
        List<Integer> keys = IntStream.range(0, 30).boxed().toList();

        // execution
        List<Integer> results = FleetCalls.inParallel(keys, key -> {
            peak.accumulateAndGet(inFlight.incrementAndGet(), Math::max);
            sleep(30);
            inFlight.decrementAndGet();
            return key * 10;
        });

        // verifications
        assertThat(results).containsExactlyElementsOf(keys.stream().map(key -> key * 10).toList());
        assertThat(peak.get()).isBetween(2, FleetCalls.MAX_IN_FLIGHT);
    }

    @Test
    void inParallel_failingCall_rethrowsItsException() {
        // execution
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> FleetCalls.inParallel(List.of(1, 2), key -> {
                    if (key == 2) {
                        throw new IllegalStateException("fleet down");
                    }
                    return key;
                }));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("fleet down");
    }

    private static void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
