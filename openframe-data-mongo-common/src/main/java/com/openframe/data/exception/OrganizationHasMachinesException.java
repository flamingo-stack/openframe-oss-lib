package com.openframe.data.exception;

import com.openframe.core.exception.ConflictException;
import com.openframe.core.exception.ErrorCode;

/**
 * Exception thrown when attempting to archive an organization that has active machines.
 */
public class OrganizationHasMachinesException extends ConflictException {

    public OrganizationHasMachinesException(String organizationId) {
        super(ErrorCode.ORGANIZATION_HAS_MACHINES,
                "This organization still has active devices. To archive it, you'll need to delete or archive all devices first.");
    }
}
