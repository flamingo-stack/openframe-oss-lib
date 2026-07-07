package com.openframe.test.data.generator;

import com.openframe.test.data.dto.device.Machine;
import com.openframe.test.data.dto.organization.Organization;
import com.openframe.test.data.dto.ticket.CreateTicketInput;
import com.openframe.test.data.dto.ticket.CreateTicketStatusInput;
import com.openframe.test.data.dto.ticket.ReorderTicketInput;
import com.openframe.test.data.dto.ticket.Ticket;
import com.openframe.test.data.dto.ticket.TicketConnection;
import com.openframe.test.data.dto.ticket.TicketEdge;
import com.openframe.test.data.dto.ticket.TicketFilterInput;
import com.openframe.test.data.dto.ticket.TicketLabel;
import com.openframe.test.data.dto.user.AuthUser;
import net.datafaker.Faker;

import java.util.List;
import java.util.Set;

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

    /**
     * First ticket whose lifecycle status kind is none of the excluded kinds. Useful on a lifecycle
     * tenant where the legacy `status` filter can still return tickets that have since moved to
     * another lifecycle status (the legacy `status` field is not synced by transitionTicket).
     */
    public static Ticket firstTicketWithStatusKindNotIn(TicketConnection connection, String... excludedKinds) {
        Set<String> excluded = Set.of(excludedKinds);
        return connection.getEdges().stream()
                .map(TicketEdge::getNode)
                .filter(ticket -> ticket.getStatusDefinition() != null
                        && !excluded.contains(ticket.getStatusDefinition().getKind()))
                .findFirst()
                .orElse(null);
    }

    public static Ticket lastTicket(TicketConnection connection) {
        return connection.getEdges().getLast().getNode();
    }

    /**
     * Reorders the column's bottom ticket to the top (before the current first ticket). Uses a single
     * anchor so the new rank is derived from one neighbor's rank (never a between-two-equal-ranks
     * collision), and keeps the ticket in its own lifecycle column (no statusId change).
     */
    public static ReorderTicketInput moveLastBeforeFirst(TicketConnection connection) {
        List<TicketEdge> edges = connection.getEdges();
        return ReorderTicketInput.builder()
                .id(edges.getLast().getNode().getId())
                .beforeTicketId(edges.getFirst().getNode().getId())
                .build();
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

    public static TicketFilterInput ticketsWithStatusId(String statusId) {
        return TicketFilterInput.builder()
                .statusIds(List.of(statusId))
                .build();
    }

    /**
     * A custom status create request with a unique name (backend enforces uniqueness and a 32-char
     * limit) and a valid 6-digit hex color (backend pattern: {@code ^#[0-9A-Fa-f]{6}$}).
     */
    public static CreateTicketStatusInput createStatusRequest() {
        return CreateTicketStatusInput.builder()
                .name("qa-" + faker.random().hex(8))
                .color("#3B82F6")
                .build();
    }
}
