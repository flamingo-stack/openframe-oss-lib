package com.openframe.stream.service.rmm;

public record AgentResultReport(Integer exitCode, Boolean timedOut, String error, String failureReason) {
}
