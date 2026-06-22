package com.openframe.api.exception;

import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.NotFoundException;

public class TimeEntryNotFoundException extends NotFoundException {

    public TimeEntryNotFoundException(String message) {
        super(ErrorCode.TIME_ENTRY_NOT_FOUND, message);
    }
}
