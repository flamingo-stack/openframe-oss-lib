package com.openframe.api.dto.ticket;

import com.openframe.data.document.ticket.TicketCreationSource;
import com.openframe.data.document.ticket.TicketEmailOrigin;
import com.openframe.data.document.ticket.TicketOwner;
import com.openframe.data.document.ticket.TicketRequester;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SystemTicketCommand {
    private String id;
    private TicketCreationSource creationSource;
    private TicketOwner owner;
    private String title;
    private String description;
    private String statusId;
    private String assigneeId;
    private String organizationId;
    private String deviceId;
    private TicketEmailOrigin emailOrigin;
    private TicketRequester requester;
    private String reporterName;
}
