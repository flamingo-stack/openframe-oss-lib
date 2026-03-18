package com.openframe.data.exception;

import com.openframe.core.exception.ConflictException;
import com.openframe.core.exception.ErrorCode;

/**
 * Exception thrown when attempting to delete an organization that has associated machines.
 */
public class OrganizationHasMachinesException extends ConflictException {

    public OrganizationHasMachinesException(String organizationId) {
        super(ErrorCode.ORGANIZATION_HAS_MACHINES,
                "Cannot delete organization " + organizationId + " because it has associated machines");
    }

    public OrganizationHasMachinesException(String organizationId, long machineCount) {
        super(ErrorCode.ORGANIZATION_HAS_MACHINES,
                "Cannot delete organization " + organizationId + " because it has " + machineCount + " associated machine(s)");
    }
}
