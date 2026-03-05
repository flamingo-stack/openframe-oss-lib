package com.openframe.core.exception;

public class NatsException extends InternalException {

    public NatsException(String message) {
        super(ErrorCode.INTERNAL_ERROR, message);
    }

    public NatsException(String message, Throwable cause) {
        super(ErrorCode.INTERNAL_ERROR, message, cause);
    }
}
