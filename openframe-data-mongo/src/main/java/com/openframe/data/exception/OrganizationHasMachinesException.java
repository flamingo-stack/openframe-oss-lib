package com.openframe.data.exception;

/**
 * Exception thrown when attempting to delete an organization that has associated machines.
 */
public class OrganizationHasMachinesException extends RuntimeException {
    
    public OrganizationHasMachinesException(String organizationId) {
        super("Cannot delete organization " + organizationId + " because it has associated machines");
    }
    
    public OrganizationHasMachinesException(String organizationId, long machineCount) {
        super("Cannot delete organization " + organizationId + " because it has " + machineCount + " associated machine(s)");
    }
}
