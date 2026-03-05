package com.openframe.data.exception;

import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.NotFoundException;

public class UserNotFoundException extends NotFoundException {

    public UserNotFoundException(String userId) {
        super(ErrorCode.USER_NOT_FOUND, "User not found: " + userId);
    }
}
