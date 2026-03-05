package com.openframe.api.exception;

import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.NotFoundException;

public class AgentRegistrationSecretNotFoundException extends NotFoundException {

    public AgentRegistrationSecretNotFoundException(ErrorCode errorCode, String message) {
        super(errorCode, message);
    }
}
