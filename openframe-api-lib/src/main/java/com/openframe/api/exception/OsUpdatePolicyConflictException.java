package com.openframe.api.exception;

import com.openframe.core.exception.ConflictException;
import com.openframe.core.exception.ErrorCode;

public class OsUpdatePolicyConflictException extends ConflictException {

    public OsUpdatePolicyConflictException(String message) {
        super(ErrorCode.OS_UPDATE_POLICY_CONFLICT, message);
    }
}
