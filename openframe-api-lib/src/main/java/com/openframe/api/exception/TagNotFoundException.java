package com.openframe.api.exception;

import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.NotFoundException;

public class TagNotFoundException extends NotFoundException {

    public TagNotFoundException(String message) {
        super(ErrorCode.TAG_NOT_FOUND, message);
    }
}
