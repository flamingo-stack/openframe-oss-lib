package com.openframe.api.exception;

import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.NotFoundException;

public class OsUpdatePolicyNotFoundException extends NotFoundException {

    public OsUpdatePolicyNotFoundException(String message) {
        super(ErrorCode.OS_UPDATE_POLICY_NOT_FOUND, message);
    }
}
