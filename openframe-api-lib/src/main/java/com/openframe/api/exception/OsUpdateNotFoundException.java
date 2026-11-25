package com.openframe.api.exception;

import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.NotFoundException;

public class OsUpdateNotFoundException extends NotFoundException {

    public OsUpdateNotFoundException(String message) {
        super(ErrorCode.OS_UPDATE_NOT_FOUND, message);
    }
}
