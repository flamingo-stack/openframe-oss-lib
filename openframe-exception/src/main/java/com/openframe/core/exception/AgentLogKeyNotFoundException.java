package com.openframe.core.exception;

public class AgentLogKeyNotFoundException extends NotFoundException {

    private static final String MESSAGE = "Agent log key not found";

    public AgentLogKeyNotFoundException() {
        super(ErrorCode.AGENT_LOG_KEY_NOT_FOUND, MESSAGE);
    }
}
