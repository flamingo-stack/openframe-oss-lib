package com.openframe.api.dto.ticket;

import com.openframe.data.document.ticket.TicketCreationSource;
import com.openframe.data.document.ticket.TicketEmailOrigin;
import com.openframe.data.document.ticket.TicketOwner;
import com.openframe.data.document.ticket.TicketRequester;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class SystemTicketCommand {
    String id;
    TicketCreationSource creationSource;
    TicketOwner owner;
    String title;
    String description;
    String statusId;
    String assigneeId;
    String organizationId;
    String deviceId;
    TicketEmailOrigin emailOrigin;
    TicketRequester requester;
    String reporterName;
}
