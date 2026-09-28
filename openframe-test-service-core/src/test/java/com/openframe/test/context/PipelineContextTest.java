package com.openframe.test.context;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pins the polarity of the standalone flag.
 *
 * <p>It is opt-out on purpose: unset has to mean "publish", so a library carrying the guard can be
 * released before the runner that sets the flag exists. Inverting it would not fail to compile and
 * would not fail any integration test — it would quietly stop the pipelines publishing their org, and
 * the install step would enrol the device into the wrong one. That is what these three assertions are
 * for.
 */
class PipelineContextTest {

    @AfterEach
    void reset() {
        PipelineContext.clear();
    }

    @Test
    @DisplayName("A run publishes to a later phase unless something says otherwise")
    void publishesByDefault() {
        PipelineContext.clear();

        assertThat(PipelineContext.isStandaloneRun())
                .as("Nothing has declared this run flat").isFalse();
        assertThat(PipelineContext.publishesToLaterPhase())
                .as("The default must stay 'publish' so an unaware runner behaves as before").isTrue();
    }

    @Test
    @DisplayName("Marking a run standalone stops it publishing")
    void markingStopsPublishing() {
        PipelineContext.clear();

        PipelineContext.markStandaloneRun();

        assertThat(PipelineContext.isStandaloneRun()).isTrue();
        assertThat(PipelineContext.publishesToLaterPhase())
                .as("A flat run hands nothing to a phase that will never come").isFalse();
    }

    @Test
    @DisplayName("clear() releases the flag with everything else")
    void clearResetsTheFlag() {
        PipelineContext.markStandaloneRun();

        PipelineContext.clear();

        assertThat(PipelineContext.isStandaloneRun())
                .as("A pipeline starting after a standalone run must not inherit its flag").isFalse();
        assertThat(PipelineContext.publishesToLaterPhase()).isTrue();
    }
}
