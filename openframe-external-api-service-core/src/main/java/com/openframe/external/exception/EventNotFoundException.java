package com.openframe.external.exception;

import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.NotFoundException;

public class EventNotFoundException extends NotFoundException {
    public EventNotFoundException(String message) {
        super(ErrorCode.EVENT_NOT_FOUND, message);
    }
}