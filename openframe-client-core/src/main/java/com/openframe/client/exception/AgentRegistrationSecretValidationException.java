package com.openframe.client.exception;

import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.UnauthorizedException;

public class AgentRegistrationSecretValidationException extends UnauthorizedException {

    public AgentRegistrationSecretValidationException(ErrorCode errorCode, String message) {
        super(errorCode, message);
    }
}
