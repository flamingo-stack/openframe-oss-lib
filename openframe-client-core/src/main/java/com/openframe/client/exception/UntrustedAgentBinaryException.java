package com.openframe.client.exception;

import com.openframe.core.exception.ForbiddenException;

import static com.openframe.core.exception.ErrorCode.AGENT_BINARY_UNTRUSTED;

public class UntrustedAgentBinaryException extends ForbiddenException {

    public UntrustedAgentBinaryException(String message) {
        super(AGENT_BINARY_UNTRUSTED, message);
    }
}
