package com.openframe.data.document.rmm.script;

public enum ExecutionStatus {
    QUEUED,
    RUNNING,
    SUCCESS,
    SCRIPT_ERROR,
    FAILED;

    public boolean isTerminal() {
        return this == SUCCESS || this == SCRIPT_ERROR || this == FAILED;
    }

    public boolean isFinal(ExecutionFailureReason failureReason) {
        if (!isTerminal()) {
            return false;
        }
        return this != FAILED || failureReason == null || !failureReason.isWatchdogVerdict();
    }
}
