package com.openframe.client.exception;

import com.openframe.core.exception.BadRequestException;

public class InvalidToolTypeException extends BadRequestException {
    public InvalidToolTypeException(String message) {
        super(message);
    }
}
