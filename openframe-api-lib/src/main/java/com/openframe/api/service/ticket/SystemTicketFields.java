package com.openframe.api.service.ticket;

import com.openframe.api.dto.ticket.SystemTicketCommand;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketCreationSource;
import com.openframe.data.document.ticket.TicketEmailOrigin;
import com.openframe.data.document.ticket.TicketOwner;
import com.openframe.data.document.ticket.TicketRequester;

// The fields of a ticket created by the system, without a caller principal: the command's own values.
public final class SystemTicketFields {

    private SystemTicketFields() {
    }

    public static Ticket newTicket(SystemTicketCommand command, Integer ticketNumber) {
        String id = command.getId();
        TicketCreationSource creationSource = command.getCreationSource();
        TicketOwner owner = command.getOwner();
        String title = command.getTitle();
        String description = command.getDescription();
        TicketEmailOrigin emailOrigin = command.getEmailOrigin();
        TicketRequester requester = command.getRequester();
        String reporterName = command.getReporterName();
        return Ticket.builder()
                .id(id)
                .ticketNumber(ticketNumber)
                .creationSource(creationSource)
                .owner(owner)
                .title(title)
                .description(description)
                .emailOrigin(emailOrigin)
                .requester(requester)
                .reporterName(reporterName)
                .build();
    }
}
