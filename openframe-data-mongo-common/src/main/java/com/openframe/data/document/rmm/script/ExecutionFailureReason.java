package com.openframe.data.document.rmm.script;

import java.util.Arrays;

public enum ExecutionFailureReason {
    NO_ACK,
    NO_AGENT_RESULT,
    AGENT_TIMED_OUT,
    NO_USER_SESSION,
    COULD_NOT_LAUNCH,
    INTERRUPTED,
    SYSTEM_SCRIPT_ERROR,
    UNKNOWN;

    public static ExecutionFailureReason fromAgent(String wireValue) {
        return Arrays.stream(values())
                .filter(reason -> reason.name().equals(wireValue))
                .findFirst()
                .orElse(UNKNOWN);
    }

    public boolean isWatchdogVerdict() {
        return this == NO_ACK || this == NO_AGENT_RESULT;
    }
}
