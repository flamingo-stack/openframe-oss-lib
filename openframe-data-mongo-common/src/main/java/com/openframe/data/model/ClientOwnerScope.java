package com.openframe.data.model;

import com.openframe.data.document.ticket.ClientTicketOwner;
import com.openframe.data.document.ticket.TicketOwner;

/**
 * What a device (AGENT token) may see of the items it owns: the ones created while the device belonged
 * to its current organization. Client-owned tickets and dialogs keep a snapshot of that organization in
 * their owner, so a device re-enrolled under another customer stops seeing the previous customer's items
 * and sees them again when it is moved back.
 *
 * <p>An owner whose snapshot is still missing (written before the backfill) stays visible, and so does
 * everything when the machine's current organization is unknown.
 *
 * @param machineId      the device of the principal
 * @param organizationId the organization the device belongs to now, or null when unknown
 */
public record ClientOwnerScope(String machineId, String organizationId) {

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
