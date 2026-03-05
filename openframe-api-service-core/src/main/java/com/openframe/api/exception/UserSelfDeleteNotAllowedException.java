package com.openframe.api.exception;

import com.openframe.core.exception.ConflictException;
import com.openframe.core.exception.ErrorCode;

public class UserSelfDeleteNotAllowedException extends ConflictException {

    public UserSelfDeleteNotAllowedException(String message) {
        super(ErrorCode.USER_SELF_DELETE_NOT_ALLOWED, message);
    }
}
