package com.openframe.test.listener;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.platform.engine.TestDescriptor;
import org.junit.platform.engine.TestExecutionResult;
import org.junit.platform.engine.UniqueId;
import org.junit.platform.engine.support.descriptor.AbstractTestDescriptor;
import org.junit.platform.launcher.TestIdentifier;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pins the order of the posted details. The report is read by whoever got pinged, in a threaded Slack
 * message of several hundred lines, so the lines they were pinged about have to be at the top of it —
 * in execution order a failure sits wherever it happened, between passes.
 */
class SlackListenerOrderTest {

    /** Captures the two strings the listener would post instead of reaching Slack. */
    private static class CapturingClient extends SlackClient {
        private String details;

        CapturingClient() {
            super(null);
        }

        @Override
        public void postThreadedReport(String summary, String details) {
            this.details = details;
        }
    }

    private static TestIdentifier testCase(String displayName) {
        return TestIdentifier.from(new AbstractTestDescriptor(
                UniqueId.root("case", displayName), displayName) {
            @Override
            public TestDescriptor.Type getType() {
                return TestDescriptor.Type.TEST;
            }
        });
    }

    @Test
    @DisplayName("Failures lead, then skips, then passes")
    void failuresFirst() {
        CapturingClient client = new CapturingClient();
        SlackListener listener = new SlackListener(client);

        listener.executionFinished(testCase("passed first"), TestExecutionResult.successful());
        listener.executionSkipped(testCase("skipped second"), "no device");
        listener.executionFinished(testCase("failed third"), TestExecutionResult.failed(new AssertionError("boom")));
        listener.executionFinished(testCase("passed fourth"), TestExecutionResult.successful());

        listener.sendResults("tag", "domain", "example.com");

        List<String> lines = List.of(client.details.strip().split("\n"));
        assertThat(lines).as("The header stays first").first().isEqualTo("*Test Details:*");
        assertThat(lines.subList(1, lines.size()))
                .as("Failure, then skip, then the passes")
                .containsExactly(
                        ":x: failed third: boom",
                        ":fast_forward: skipped second: no device",
                        ":white_check_mark: passed first",
                        ":white_check_mark: passed fourth");
    }

    @Test
    @DisplayName("Execution order survives inside a rank")
    void stableWithinRank() {
        CapturingClient client = new CapturingClient();
        SlackListener listener = new SlackListener(client);

        listener.executionFinished(testCase("failed early"), TestExecutionResult.failed(new AssertionError("first")));
        listener.executionFinished(testCase("passed between"), TestExecutionResult.successful());
        listener.executionFinished(testCase("failed late"), TestExecutionResult.failed(new AssertionError("second")));

        listener.sendResults("tag", "domain", "example.com");

        assertThat(client.details)
                .as("A failure and whatever it cascaded into still read in the order they happened")
                .containsSubsequence(":x: failed early: first", ":x: failed late: second");
    }
}
