package com.openframe.core.exception;

public class ApiKeyException extends InternalException {

    public ApiKeyException(String message) {
        super(ErrorCode.INTERNAL_ERROR, message);
    }

    public ApiKeyException(String message, Throwable cause) {
        super(ErrorCode.INTERNAL_ERROR, message, cause);
    }
}
