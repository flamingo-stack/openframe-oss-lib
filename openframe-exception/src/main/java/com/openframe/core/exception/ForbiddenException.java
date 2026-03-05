package com.openframe.core.exception;

import org.springframework.http.HttpStatus;

public class ForbiddenException extends BaseException {

    public ForbiddenException(String message) {
        super(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN, message);
    }

    public ForbiddenException(ErrorCode errorCode, String message) {
        super(errorCode, HttpStatus.FORBIDDEN, message);
    }

    public ForbiddenException(ErrorCode errorCode, String message, Throwable cause) {
        super(errorCode, HttpStatus.FORBIDDEN, message, cause);
    }
}
