package com.openframe.authz.exception;

import com.openframe.core.exception.ConflictException;
import com.openframe.core.exception.ErrorCode;

public class UserActiveInAnotherTenantException extends ConflictException {
    public UserActiveInAnotherTenantException(String email) {
        super(ErrorCode.USER_ACTIVE_IN_ANOTHER_TENANT, "User is active in another tenant: " + email);
    }
}
