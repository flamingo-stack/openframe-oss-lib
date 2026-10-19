package com.openframe.client.exception;

import com.openframe.core.exception.ForbiddenException;

import static com.openframe.core.exception.ErrorCode.AGENT_SIGNATURE_UNTRUSTED;

public class UntrustedAgentSignatureException extends ForbiddenException {

    public UntrustedAgentSignatureException(String message) {
        super(AGENT_SIGNATURE_UNTRUSTED, message);
    }
}
