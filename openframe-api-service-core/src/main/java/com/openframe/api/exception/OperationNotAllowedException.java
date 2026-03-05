package com.openframe.api.exception;

import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.ForbiddenException;

public class OperationNotAllowedException extends ForbiddenException {

    public OperationNotAllowedException(String message) {
        super(ErrorCode.OPERATION_NOT_ALLOWED, message);
    }
}
