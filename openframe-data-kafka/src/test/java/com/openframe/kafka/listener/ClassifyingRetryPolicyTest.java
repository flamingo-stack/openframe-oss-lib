package com.openframe.kafka.listener;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.kafka.support.serializer.DeserializationException;
import org.springframework.util.backoff.BackOffExecution;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

// The shared retry rules of Kafka consumers: a record no retry can fix goes to the dead-letter topic at once, an
// unreachable store is waited out without limit, anything else gets five attempts.
class ClassifyingRetryPolicyTest {

    private static final int MANY = 500;

    @Test
    void defaults_unparsableRecord_noRetry() {
        // execution
        List<Long> intervals = intervals(ClassifyingRetryPolicy.defaults(),
                new IllegalStateException(new DeserializationException("bad", new byte[0], false, null)), MANY);

        // verifications
        assertThat(intervals).containsExactly(BackOffExecution.STOP);
    }

    @Test
    void defaults_storeUnavailable_retriedEveryFiveSecondsWithoutLimit() {
        // execution
        List<Long> intervals = intervals(ClassifyingRetryPolicy.defaults(),
                new RuntimeException(new DataAccessResourceFailureException("down")), MANY);

        // verifications
        assertThat(intervals).hasSize(MANY).containsOnly(5_000L);
    }

    @Test
    void defaults_transientDataAccess_retriedWithoutLimit() {
        // execution
        List<Long> intervals = intervals(ClassifyingRetryPolicy.defaults(), new QueryTimeoutException("slow"), MANY);

        // verifications
        assertThat(intervals).doesNotContain(BackOffExecution.STOP);
    }

    @Test
    void defaults_optimisticLockConflict_notWaitedOutForever() {
        // execution
        List<Long> intervals = intervals(ClassifyingRetryPolicy.defaults(),
                new OptimisticLockingFailureException("conflict"), MANY);

        // verifications
        assertThat(intervals).containsExactly(1_000L, 3_000L, 9_000L, 27_000L, BackOffExecution.STOP);
    }

    @Test
    void defaults_otherFailure_fiveAttemptsOneThreeNineTwentySevenSeconds() {
        // execution
        List<Long> intervals = intervals(ClassifyingRetryPolicy.defaults(), new IllegalStateException("boom"), MANY);

        // verifications
        assertThat(intervals).containsExactly(1_000L, 3_000L, 9_000L, 27_000L, BackOffExecution.STOP);
    }

    @Test
    void builder_addedTypes_classifiedOnTopOfTheDefaults() {
        // setup
        ClassifyingRetryPolicy policy = ClassifyingRetryPolicy.builder()
                .notRetryable(UnsupportedOperationException.class)
                .unavailable(IllegalArgumentException.class)
                .build();

        // execution and verifications
        assertThat(intervals(policy, new UnsupportedOperationException(), MANY)).containsExactly(BackOffExecution.STOP);
        assertThat(intervals(policy, new IllegalArgumentException(), MANY)).doesNotContain(BackOffExecution.STOP);
        assertThat(intervals(policy, new IllegalStateException(new DeserializationException("bad", new byte[0],
                false, null)), MANY)).containsExactly(BackOffExecution.STOP);
    }

    @Test
    void notRetryable_winsOverUnavailable_anywhereInTheCauseChain() {
        // setup
        ClassifyingRetryPolicy policy = ClassifyingRetryPolicy.builder()
                .notRetryable(UnsupportedOperationException.class)
                .build();
        Exception both = new DataAccessResourceFailureException("down", new UnsupportedOperationException());

        // execution and verifications
        assertThat(intervals(policy, both, MANY)).containsExactly(BackOffExecution.STOP);
    }

    @Test
    void builder_customIntervals() {
        // setup
        ClassifyingRetryPolicy policy = ClassifyingRetryPolicy.builder()
                .retries(2)
                .initialInterval(Duration.ofMillis(100))
                .multiplier(2.0)
                .maxInterval(Duration.ofMillis(150))
                .unavailableInterval(Duration.ofSeconds(1))
                .build();

        // execution and verifications
        assertThat(intervals(policy, new IllegalStateException(), MANY))
                .containsExactly(100L, 150L, BackOffExecution.STOP);
        assertThat(intervals(policy, new DataAccessResourceFailureException("down"), 3))
                .containsExactly(1_000L, 1_000L, 1_000L);
    }

    private static List<Long> intervals(ConsumerRetryPolicy policy, Exception failure, int max) {
        BackOffExecution execution = policy.backOffFor(null, failure).start();
        List<Long> intervals = new ArrayList<>();
        for (int i = 0; i < max; i++) {
            long next = execution.nextBackOff();
            intervals.add(next);
            if (next == BackOffExecution.STOP) {
                break;
            }
        }
        return intervals;
    }
}
