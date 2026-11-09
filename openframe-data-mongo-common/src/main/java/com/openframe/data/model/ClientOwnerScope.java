package com.openframe.data.model;

import com.openframe.data.document.ticket.ClientTicketOwner;
import com.openframe.data.document.ticket.TicketOwner;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.ToString;

// What a device (AGENT token) may see of the items it owns: those created while it belonged to its current customer.
// Client tickets and dialogs keep that customer in their owner; a missing snapshot (pre-backfill) and an unknown
// machine organization both stay visible.
@Getter
@ToString
@EqualsAndHashCode
@AllArgsConstructor
public class ClientOwnerScope {

    private final String machineId;
    private final String organizationId;

    public boolean allows(TicketOwner owner) {
        return owner instanceof ClientTicketOwner client
                && allows(client.getMachineId(), client.getOrganizationId());
    }

    public boolean allows(String ownerMachineId, String ownerOrganizationId) {
        if (ownerMachineId == null || !ownerMachineId.equals(machineId)) {
            return false;
        }
        return organizationId == null
                || ownerOrganizationId == null
                || organizationId.equals(ownerOrganizationId);
    }
}
