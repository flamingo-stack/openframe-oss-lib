package com.openframe.core.exception;

import org.springframework.http.HttpStatus;

public class NotFoundException extends BaseException {

    public NotFoundException(String message) {
        super(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, message);
    }

    public NotFoundException(ErrorCode errorCode, String message) {
        super(errorCode, HttpStatus.NOT_FOUND, message);
    }

    public NotFoundException(ErrorCode errorCode, String message, Throwable cause) {
        super(errorCode, HttpStatus.NOT_FOUND, message, cause);
    }
}
