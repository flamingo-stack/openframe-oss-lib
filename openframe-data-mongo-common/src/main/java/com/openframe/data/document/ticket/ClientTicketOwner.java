package com.openframe.data.document.ticket;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
public class ClientTicketOwner extends TicketOwner {

    private String machineId;

    // The customer the machine belonged to when the ticket was created; never updated, null before the backfill.
    private String organizationId;

    public ClientTicketOwner(String machineId, String organizationId) {
        this.type = TicketOwnerType.CLIENT;
        this.machineId = machineId;
        this.organizationId = organizationId;
    }
}
