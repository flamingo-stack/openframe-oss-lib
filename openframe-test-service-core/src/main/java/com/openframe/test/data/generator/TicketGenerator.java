package com.openframe.test.data.generator;

import com.openframe.test.data.dto.device.Machine;
import com.openframe.test.data.dto.organization.Organization;
import com.openframe.test.data.dto.ticket.CreateTicketInput;
import com.openframe.test.data.dto.ticket.ReorderTicketInput;
import com.openframe.test.data.dto.ticket.Ticket;
import com.openframe.test.data.dto.ticket.TicketConnection;
import com.openframe.test.data.dto.ticket.TicketEdge;
import com.openframe.test.data.dto.ticket.TicketFilterInput;
import com.openframe.test.data.dto.ticket.TicketLabel;
import com.openframe.test.data.dto.user.AuthUser;
import net.datafaker.Faker;

import java.util.List;

public class TicketGenerator {

    private static final Faker faker = new Faker();

    public static String assigneeId(List<AuthUser> users) {
        return users.get(faker.random().nextInt(users.size())).getId();
    }

    public static Ticket firstTicket(TicketConnection connection) {
        return connection.getEdges().getFirst().getNode();
    }

    public static String firstTicketId(TicketConnection connection) {
        return firstTicket(connection).getId();
    }

    public static ReorderTicketInput reorderRequest(TicketConnection connection) {
        List<TicketEdge> edges = connection.getEdges();
        return ReorderTicketInput.builder()
                .id(edges.get(2).getNode().getId())
                .afterTicketId(edges.get(1).getNode().getId())
                .beforeTicketId(edges.get(0).getNode().getId())
                .build();
    }

    public static String reorderTargetOrder(TicketConnection connection) {
        return connection.getEdges().get(2).getNode().getOrder();
    }

    public static CreateTicketInput createTicketRequest(Organization organization,
                                                        Machine device,
                                                        String assigneeId,
                                                        List<TicketLabel> labels) {
        return CreateTicketInput.builder()
                .title("Test ticket")
                .description("Manually created ticket for tests")
                .organizationId(organization.getOrganizationId())
                .deviceId(device.getMachineId())
                .assigneeId(assigneeId)
                .labelIds(labels.stream().map(TicketLabel::getId).toList())
                .build();
    }

    public static TicketFilterInput activeTickets() {
        return TicketFilterInput.builder()
                .statuses(List.of("ACTIVE"))
                .build();
    }

    public static TicketFilterInput resolvedTickets() {
        return TicketFilterInput.builder()
                .statuses(List.of("RESOLVED"))
                .build();
    }
}
