package com.openframe.core.exception;

import org.springframework.http.HttpStatus;

public class InternalException extends BaseException {

    public InternalException(String message) {
        super(ErrorCode.INTERNAL_ERROR, HttpStatus.INTERNAL_SERVER_ERROR, message);
    }

    public InternalException(ErrorCode errorCode, String message) {
        super(errorCode, HttpStatus.INTERNAL_SERVER_ERROR, message);
    }

    public InternalException(ErrorCode errorCode, String message, Throwable cause) {
        super(errorCode, HttpStatus.INTERNAL_SERVER_ERROR, message, cause);
    }
}
