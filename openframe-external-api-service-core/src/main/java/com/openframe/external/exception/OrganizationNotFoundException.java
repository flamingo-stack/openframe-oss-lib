package com.openframe.external.exception;

import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.NotFoundException;

/**
 * Exception thrown when an organization is not found.
 */
public class OrganizationNotFoundException extends NotFoundException {
    public OrganizationNotFoundException(String organizationId) {
        super(ErrorCode.ORGANIZATION_NOT_FOUND, "Organization not found: " + organizationId);
    }
}
