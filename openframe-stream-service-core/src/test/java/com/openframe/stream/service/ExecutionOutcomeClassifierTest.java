package com.openframe.stream.service;

import com.openframe.data.document.rmm.script.ExecutionFailureReason;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.stream.service.rmm.AgentResultReport;
import com.openframe.stream.service.rmm.ExecutionOutcome;
import com.openframe.stream.service.rmm.ExecutionOutcomeClassifier;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class ExecutionOutcomeClassifierTest {

    private static final String TRUNCATED = "output truncated: exceeded transport size limit";

    private final ExecutionOutcomeClassifier classifier = new ExecutionOutcomeClassifier(true);
    private final ExecutionOutcomeClassifier legacyClassifier = new ExecutionOutcomeClassifier(false);

    @Test
    @DisplayName("exit 0, nothing else → SUCCESS without a reason")
    void cleanRun_isSuccess() {
        assertThat(classifier.classify(report(0, false, null, null), false))
                .isEqualTo(new ExecutionOutcome(ExecutionStatus.SUCCESS, null));
    }

    @Test
    @DisplayName("no exit code and nothing else → SUCCESS, as before")
    void noExitCode_isSuccess() {
        assertThat(classifier.classify(report(null, null, null, null), false).status()).isEqualTo(ExecutionStatus.SUCCESS);
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 3, 85, 98, -1})
    @DisplayName("the script's own non-zero exit → SCRIPT_ERROR without a reason")
    void ownNonZeroExit_isScriptError(int exitCode) {
        assertThat(classifier.classify(report(exitCode, false, null, null), false))
                .isEqualTo(new ExecutionOutcome(ExecutionStatus.SCRIPT_ERROR, null));
    }

    @Test
    @DisplayName("flag off: the script's own non-zero exit stays FAILED, as before, without a reason")
    void ownNonZeroExit_flagOff_isFailed() {
        assertThat(legacyClassifier.classify(report(1, false, null, null), false))
                .isEqualTo(new ExecutionOutcome(ExecutionStatus.FAILED, null));
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    @DisplayName("an OpenFrame-owned script exiting non-zero → FAILED / SYSTEM_SCRIPT_ERROR, flag on or off")
    void systemOwnedNonZeroExit_isSystemScriptError(boolean flag) {
        ExecutionOutcomeClassifier subject = flag ? classifier : legacyClassifier;
        assertThat(subject.classify(report(1, false, null, null), true))
                .isEqualTo(new ExecutionOutcome(ExecutionStatus.FAILED, ExecutionFailureReason.SYSTEM_SCRIPT_ERROR));
    }

    @Test
    @DisplayName("an OpenFrame-owned script exiting 0 → SUCCESS")
    void systemOwnedCleanRun_isSuccess() {
        assertThat(classifier.classify(report(0, false, null, null), true).status()).isEqualTo(ExecutionStatus.SUCCESS);
    }

    @ParameterizedTest
    @EnumSource(value = ExecutionFailureReason.class, names = {"AGENT_TIMED_OUT", "NO_USER_SESSION", "COULD_NOT_LAUNCH", "INTERRUPTED"})
    @DisplayName("every reason the agent sends → FAILED with that reason, whatever the exit code")
    void agentReason_isFailedWithIt(ExecutionFailureReason reason) {
        assertThat(classifier.classify(report(0, false, null, reason.name()), false))
                .isEqualTo(new ExecutionOutcome(ExecutionStatus.FAILED, reason));
    }

    @Test
    @DisplayName("an agent reason wins over a system-owned non-zero exit")
    void agentReason_winsOverSystemOwned() {
        assertThat(classifier.classify(report(85, false, "spawn failed", "COULD_NOT_LAUNCH"), true).failureReason())
                .isEqualTo(ExecutionFailureReason.COULD_NOT_LAUNCH);
    }

    @Test
    @DisplayName("a reason this backend does not know → FAILED / UNKNOWN")
    void unknownAgentReason_isUnknown() {
        assertThat(classifier.classify(report(1, false, null, "DISK_FULL"), false))
                .isEqualTo(new ExecutionOutcome(ExecutionStatus.FAILED, ExecutionFailureReason.UNKNOWN));
    }

    @Test
    @DisplayName("a blank reason is no reason")
    void blankAgentReason_isIgnored() {
        assertThat(classifier.classify(report(1, false, null, " "), false).status()).isEqualTo(ExecutionStatus.SCRIPT_ERROR);
    }

    @Test
    @DisplayName("legacy agent: timed_out → FAILED / AGENT_TIMED_OUT")
    void legacyTimeout_isAgentTimedOut() {
        assertThat(classifier.classify(report(98, true, null, null), false))
                .isEqualTo(new ExecutionOutcome(ExecutionStatus.FAILED, ExecutionFailureReason.AGENT_TIMED_OUT));
    }

    @Test
    @DisplayName("legacy agent: exit 85 with a launch error → FAILED / COULD_NOT_LAUNCH")
    void legacyLaunchError_isCouldNotLaunch() {
        assertThat(classifier.classify(report(85, false, "unsupported shell 'zsh'", null), false))
                .isEqualTo(new ExecutionOutcome(ExecutionStatus.FAILED, ExecutionFailureReason.COULD_NOT_LAUNCH));
    }

    @ParameterizedTest
    @ValueSource(strings = {"interrupted by agent restart; outcome unknown", "not executed: agent restarted earlier in batch"})
    @DisplayName("legacy agent: exit 85 with a restart error → FAILED / INTERRUPTED")
    void legacyRestartError_isInterrupted(String error) {
        assertThat(classifier.classify(report(85, false, error, null), false).failureReason())
                .isEqualTo(ExecutionFailureReason.INTERRUPTED);
    }

    @ParameterizedTest
    @ValueSource(strings = {"no active interactive user (USER privilege)", "run_as_user requested but no active interactive session"})
    @DisplayName("legacy agent: exit 85 with a missing-user error → FAILED / NO_USER_SESSION")
    void legacyNoUserError_isNoUserSession(String error) {
        assertThat(classifier.classify(report(85, false, error, null), false).failureReason())
                .isEqualTo(ExecutionFailureReason.NO_USER_SESSION);
    }

    @Test
    @DisplayName("exit 85 with only the truncation marker → the script's own exit 85, SCRIPT_ERROR")
    void exit85WithTruncationMarker_isScriptError() {
        assertThat(classifier.classify(report(85, false, TRUNCATED, null), false))
                .isEqualTo(new ExecutionOutcome(ExecutionStatus.SCRIPT_ERROR, null));
    }

    @Test
    @DisplayName("exit 85 with no error → the script's own exit 85, SCRIPT_ERROR")
    void exit85WithoutError_isScriptError() {
        assertThat(classifier.classify(report(85, false, null, null), false).status()).isEqualTo(ExecutionStatus.SCRIPT_ERROR);
    }

    @Test
    @DisplayName("exit 0 with the truncation marker → SUCCESS, truncation is not a failure")
    void cleanRunWithTruncationMarker_isSuccess() {
        assertThat(classifier.classify(report(0, false, TRUNCATED, null), false).status()).isEqualTo(ExecutionStatus.SUCCESS);
    }

    @Test
    @DisplayName("an error on a non-85 exit is output, not a launch failure")
    void errorOnOtherExit_isScriptError() {
        assertThat(classifier.classify(report(1, false, "boom", null), false))
                .isEqualTo(new ExecutionOutcome(ExecutionStatus.SCRIPT_ERROR, null));
    }

    private static AgentResultReport report(Integer exitCode, Boolean timedOut, String error, String failureReason) {
        return new AgentResultReport(exitCode, timedOut, error, failureReason);
    }
}
