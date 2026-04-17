package com.openframe.data.document.ticket;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
public class ClientTicketOwner extends TicketOwner {

    private String machineId;

    public ClientTicketOwner(String machineId) {
        this.type = TicketOwnerType.CLIENT;
        this.machineId = machineId;
    }
}
