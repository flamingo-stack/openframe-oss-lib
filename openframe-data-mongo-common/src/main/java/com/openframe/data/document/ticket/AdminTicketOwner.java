package com.openframe.data.document.ticket;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
public class AdminTicketOwner extends TicketOwner {

    private String userId;

    public AdminTicketOwner(String userId) {
        this.type = TicketOwnerType.ADMIN;
        this.userId = userId;
    }
}
