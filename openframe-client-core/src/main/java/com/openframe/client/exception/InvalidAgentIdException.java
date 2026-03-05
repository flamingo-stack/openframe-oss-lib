package com.openframe.client.exception;

import com.openframe.core.exception.BadRequestException;

public class InvalidAgentIdException extends BadRequestException {
    public InvalidAgentIdException(String message) {
        super(message);
    }
}
