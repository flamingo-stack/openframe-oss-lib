package com.openframe.audit;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RecordedFailuresTest {

    @Test
    void contains_addedFailure_isTrueForItAndItsCauses() {
        IllegalStateException cause = new IllegalStateException("Ticket is archived");
        RuntimeException failure = new RuntimeException(cause);

        RecordedFailures.add(failure);

        assertThat(RecordedFailures.contains(failure)).isTrue();
        assertThat(RecordedFailures.contains(cause)).isTrue();
    }

    @Test
    void contains_wrapperOfAnAddedFailure_isTrue() {
        IllegalStateException failure = new IllegalStateException("Ticket is archived");

        RecordedFailures.add(failure);

        assertThat(RecordedFailures.contains(new RuntimeException(failure))).isTrue();
    }

    @Test
    void contains_failureNeverAdded_isFalse() {
        assertThat(RecordedFailures.contains(new IllegalStateException("another"))).isFalse();
    }

    @Test
    void contains_anotherFailureThatEqualsAnAddedOne_isFalse() {
        RecordedFailures.add(new SameAsAnyOther());

        assertThat(RecordedFailures.contains(new SameAsAnyOther())).isFalse();
    }

    private static class SameAsAnyOther extends RuntimeException {

        @Override
        public boolean equals(Object other) {
            return other instanceof SameAsAnyOther;
        }

        @Override
        public int hashCode() {
            return 1;
        }
    }
}
