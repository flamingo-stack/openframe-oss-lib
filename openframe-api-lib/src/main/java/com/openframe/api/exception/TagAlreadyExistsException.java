package com.openframe.api.exception;

import com.openframe.core.exception.ConflictException;
import com.openframe.core.exception.ErrorCode;

public class TagAlreadyExistsException extends ConflictException {

    public TagAlreadyExistsException(String message) {
        super(ErrorCode.TAG_ALREADY_EXISTS, message);
    }
}
