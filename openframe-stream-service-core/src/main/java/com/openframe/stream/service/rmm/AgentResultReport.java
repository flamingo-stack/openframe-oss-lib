package com.openframe.stream.service.rmm;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class AgentResultReport {

    private final Integer exitCode;
    private final Boolean timedOut;
    private final String error;
    private final String failureReason;
}
