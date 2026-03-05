package com.openframe.external.exception;

import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.NotFoundException;

public class LogNotFoundException extends NotFoundException {
    public LogNotFoundException(String message) {
        super(ErrorCode.LOG_NOT_FOUND, message);
    }
}
