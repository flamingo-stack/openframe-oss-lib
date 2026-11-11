package com.openframe.data.model;

import com.openframe.data.document.ticket.ClientTicketOwner;
import com.openframe.data.document.ticket.TicketOwner;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.ToString;

import java.time.Instant;

@Getter
@ToString
@EqualsAndHashCode
@AllArgsConstructor
public class ClientOwnerScope {

    private final String machineId;
    private final String organizationId;
    private final Instant organizationAssignedAt;

    public boolean allows(TicketOwner owner, Instant createdAt) {
        return owner instanceof ClientTicketOwner client
                && allows(client.getMachineId(), client.getOrganizationId(), createdAt);
    }

    public boolean allows(String ownerMachineId, String ownerOrganizationId, Instant createdAt) {
        if (ownerMachineId == null || !ownerMachineId.equals(machineId)) {
            return false;
        }
        boolean sameCustomer = organizationId == null
                || ownerOrganizationId == null
                || organizationId.equals(ownerOrganizationId);
        return sameCustomer && isSinceAssignment(createdAt);
    }

    private boolean isSinceAssignment(Instant createdAt) {
        return organizationAssignedAt == null || (createdAt != null && !createdAt.isBefore(organizationAssignedAt));
    }
}
