package com.openframe.authz.exception;

import com.openframe.core.exception.ConflictException;
import com.openframe.core.exception.ErrorCode;

public class OwnerCannotSwitchTenantException extends ConflictException {
    public OwnerCannotSwitchTenantException(String email) {
        super(ErrorCode.OWNER_CANNOT_SWITCH_TENANT, "Tenant owner cannot switch tenant: " + email);
    }
}
