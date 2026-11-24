package com.openframe.gateway.config.error;

import org.junit.jupiter.api.Test;
import reactor.core.publisher.Mono;

import static org.assertj.core.api.Assertions.assertThat;

class TracebackFreeFailureTest {

    @Test
    void of_failureWithCheckpoint_checkpointLeftOut() {
        // setup
        Mono<Object> failing = Mono.error(new IllegalStateException("boom")).checkpoint("HTTP GET \"/p?token=abc\"");
        Throwable source = failing.materialize().block().getThrowable();

        // execution
        Throwable copy = TracebackFreeFailure.of(source);

        // verifications
        assertThat(source.getSuppressed()).isNotEmpty();
        assertThat(copy.getSuppressed()).isEmpty();
    }

    @Test
    void of_failureWithCauseAndSuppressed_descriptionStackCauseAndSuppressedKept() {
        // setup
        IllegalStateException source = new IllegalStateException("boom", new IllegalArgumentException("root"));
        source.addSuppressed(new UnsupportedOperationException("side"));

        // execution
        Throwable copy = TracebackFreeFailure.of(source);

        // verifications
        assertThat(copy)
                .hasToString("java.lang.IllegalStateException: boom")
                .hasMessage("boom");
        assertThat(copy.getStackTrace()).isEqualTo(source.getStackTrace());
        assertThat(copy.getCause()).hasToString("java.lang.IllegalArgumentException: root");
        assertThat(copy.getSuppressed())
                .extracting(Throwable::toString)
                .containsExactly("java.lang.UnsupportedOperationException: side");
    }

    @Test
    void of_selfReferencingSuppressedChain_terminates() {
        // setup
        IllegalStateException first = new IllegalStateException("first");
        IllegalStateException second = new IllegalStateException("second", first);
        first.addSuppressed(second);

        // execution
        Throwable copy = TracebackFreeFailure.of(second);

        // verifications
        assertThat(copy.getCause().getSuppressed()).isEmpty();
    }

    @Test
    void of_nullFailure_null() {
        // setup
        Throwable source = null;

        // execution
        Throwable copy = TracebackFreeFailure.of(source);

        // verifications
        assertThat(copy).isNull();
    }
}
