package com.openframe.stream.service.rmm;

import com.openframe.data.document.rmm.script.ExecutionFailureReason;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import lombok.RequiredArgsConstructor;

import java.util.Set;

import static org.springframework.util.StringUtils.hasText;

@RequiredArgsConstructor
public class ExecutionOutcomeClassifier {

    static final int LEGACY_NOT_LAUNCHED_EXIT_CODE = 85;
    static final String TRUNCATION_MARKER = "output truncated: exceeded transport size limit";
    static final Set<String> LEGACY_INTERRUPTED_ERRORS = Set.of(
            "interrupted by agent restart; outcome unknown",
            "not executed: agent restarted earlier in batch");
    static final String LEGACY_NO_USER_SESSION_ERROR = "no active interactive";

    private final boolean scriptErrorStatus;

    public ExecutionOutcome classify(AgentResultReport report, boolean systemOwned) {
        ExecutionFailureReason agentFailure = agentFailure(report);
        if (agentFailure != null) {
            return new ExecutionOutcome(ExecutionStatus.FAILED, agentFailure);
        }
        Integer exitCode = report.exitCode();
        if (exitCode == null || exitCode == 0) {
            return new ExecutionOutcome(ExecutionStatus.SUCCESS, null);
        }
        if (systemOwned) {
            return new ExecutionOutcome(ExecutionStatus.FAILED, ExecutionFailureReason.SYSTEM_SCRIPT_ERROR);
        }
        return new ExecutionOutcome(scriptErrorStatus ? ExecutionStatus.SCRIPT_ERROR : ExecutionStatus.FAILED, null);
    }

    private static ExecutionFailureReason agentFailure(AgentResultReport report) {
        if (hasText(report.failureReason())) {
            return ExecutionFailureReason.fromAgent(report.failureReason());
        }
        if (Boolean.TRUE.equals(report.timedOut())) {
            return ExecutionFailureReason.AGENT_TIMED_OUT;
        }
        if (isLegacyNotLaunched(report)) {
            return legacyNotLaunchedReason(report.error());
        }
        return null;
    }

    private static boolean isLegacyNotLaunched(AgentResultReport report) {
        Integer exitCode = report.exitCode();
        String error = report.error();
        return exitCode != null && exitCode == LEGACY_NOT_LAUNCHED_EXIT_CODE
                && hasText(error) && !TRUNCATION_MARKER.equals(error);
    }

    private static ExecutionFailureReason legacyNotLaunchedReason(String error) {
        if (LEGACY_INTERRUPTED_ERRORS.contains(error)) {
            return ExecutionFailureReason.INTERRUPTED;
        }
        if (error.contains(LEGACY_NO_USER_SESSION_ERROR)) {
            return ExecutionFailureReason.NO_USER_SESSION;
        }
        return ExecutionFailureReason.COULD_NOT_LAUNCH;
    }
}
