package com.openframe.stream.service.rmm;

import com.openframe.data.document.rmm.script.ExecutionFailureReason;
import com.openframe.data.document.rmm.script.ExecutionStatus;

public record ExecutionOutcome(ExecutionStatus status, ExecutionFailureReason failureReason) {

    public boolean succeeded() {
        return status == ExecutionStatus.SUCCESS;
    }
}
