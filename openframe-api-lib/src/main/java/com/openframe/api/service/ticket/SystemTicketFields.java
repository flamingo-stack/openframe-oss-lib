package com.openframe.api.service.ticket;

import com.openframe.api.dto.ticket.SystemTicketCommand;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketCreationSource;
import com.openframe.data.document.ticket.TicketEmailOrigin;
import com.openframe.data.document.ticket.TicketOwner;
import com.openframe.data.document.ticket.TicketRequester;
import com.openframe.data.document.user.User;

// The fields of a ticket created by the system, without a caller principal: the command's own values, then each reference it resolved.
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

    public static void applyAssignee(Ticket ticket, User assignee) {
        String assigneeId = assignee.getId();
        String assigneeName = TicketUserNames.displayName(assignee);
        ticket.setAssignedTo(assigneeId);
        ticket.setAssignedName(assigneeName);
    }

    public static void applyOrganization(Ticket ticket, Organization organization) {
        String organizationId = organization.getOrganizationId();
        String organizationName = organization.getName();
        ticket.setOrganizationId(organizationId);
        ticket.setOrganizationName(organizationName);
    }

    public static void applyDevice(Ticket ticket, Machine device) {
        String deviceId = device.getMachineId();
        String deviceHostname = device.preferredName();
        ticket.setDeviceId(deviceId);
        ticket.setDeviceHostname(deviceHostname);
    }
}
