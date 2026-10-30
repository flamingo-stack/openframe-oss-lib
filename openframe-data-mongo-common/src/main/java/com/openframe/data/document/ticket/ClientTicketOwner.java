package com.openframe.data.document.ticket;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
public class ClientTicketOwner extends TicketOwner {

    private String machineId;

    /**
     * Organization the machine belonged to when the ticket was created. Never updated afterwards, so it
     * tells which customer's device opened the ticket even after the machine moves; null on documents
     * written before the field existed.
     */
    private String organizationId;

    public ClientTicketOwner(String machineId, String organizationId) {
        this.type = TicketOwnerType.CLIENT;
        this.machineId = machineId;
        this.organizationId = organizationId;
    }
}
