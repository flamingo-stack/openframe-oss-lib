package com.openframe.data.repository.device.publishing;

import com.openframe.data.document.ticket.TicketOwner;
import com.openframe.data.document.ticket.TicketStatusKind;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;

// The ticket fields MachineOnClientTicketsProjection reconciles; the job reads only these. Names are Ticket's properties.
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TicketClientOwnerView {

    @Id
    private String id;
    private String tenantId;
    private TicketStatusKind statusKind;
    private TicketOwner owner;
}
