package com.openframe.client.exception;

import com.openframe.core.exception.UnauthorizedException;

public class AgentRegistrationSecretValidationErrorException extends UnauthorizedException {

    public AgentRegistrationSecretValidationErrorException(String message) {
        super(message);
    }
}
