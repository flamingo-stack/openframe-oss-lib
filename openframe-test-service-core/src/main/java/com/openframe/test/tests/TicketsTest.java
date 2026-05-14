package com.openframe.test.tests;

import com.openframe.test.api.DeviceApi;
import com.openframe.test.api.OrganizationApi;
import com.openframe.test.api.TicketApi;
import com.openframe.test.api.UserApi;
import com.openframe.test.config.UserConfig;
import com.openframe.test.data.dto.device.Machine;
import com.openframe.test.data.dto.organization.Organization;
import com.openframe.test.data.dto.shared.CursorPaginationInput;
import com.openframe.test.data.dto.ticket.*;
import com.openframe.test.data.dto.user.AuthUser;
import com.openframe.test.data.generator.TicketGenerator;
import org.junit.jupiter.api.*;

import java.util.List;

import static com.openframe.test.data.generator.DeviceGenerator.offlineDevicesFilter;
import static com.openframe.test.data.generator.DeviceGenerator.onlineDevicesFilter;
import static org.assertj.core.api.Assertions.assertThat;

@Tag("saas")
@DisplayName("Tickets")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class TicketsTest extends BaseTest {

    @Tag("saas")
    @Tag("read")
    @Test
    @DisplayName("List tickets")
    public void testListTickets() {
        TicketConnection connection = TicketApi.getTickets(
                TicketGenerator.activeTickets(),
                CursorPaginationInput.builder().limit(20).build(),
                null);
        assertThat(connection).as("Tickets connection should not be null").isNotNull();
        assertThat(connection.getEdges()).as("Expected at least one ticket").isNotEmpty();
        assertThat(connection.getEdges()).withFailMessage("Expected tickets to have mandatory fields").allSatisfy(edge -> {
            Ticket ticket = edge.getNode();
            assertThat(ticket.getId()).as("No Id").isNotNull();
            assertThat(ticket.getTicketNumber()).as("No ticketNumber for " + ticket.getId()).isNotNull();
            assertThat(ticket.getTitle()).as("No title for " + ticket.getId()).isNotEmpty();
            assertThat(ticket.getStatus()).as("No status for " + ticket.getId()).isNotEmpty();
        });
    }

    @Tag("saas")
    @Tag("read")
    @Test
    @DisplayName("List ticket labels")
    public void testListTicketLabels() {
        List<TicketLabel> labels = TicketApi.getTicketLabels();
        assertThat(labels).as("Expected at least one ticket label").isNotEmpty();
        assertThat(labels).allSatisfy(label -> {
            assertThat(label.getId()).as("No Id").isNotNull();
            assertThat(label.getKey()).as("No key for " + label.getId()).isNotEmpty();
        });
    }

    @Test
    @DisplayName("Create ticket")
    @Order(1)
    public void testCreateTicket() {
        String email = UserConfig.getUser().getEmail();
        String assigneeId = UserApi.getUsers().stream()
                .filter(u -> email.equalsIgnoreCase(u.getEmail()))
                .map(AuthUser::getId)
                .findFirst()
                .orElseThrow(() -> new AssertionError("Current user not found by email: " + email));

        Organization organization = OrganizationApi.getOrganizations(true).getFirst();
        Machine device = DeviceApi.getAnyDevice(onlineDevicesFilter(), offlineDevicesFilter());
        assertThat(device).as("Expected at least one device").isNotNull();

        List<TicketLabel> labels = TicketApi.getTicketLabels();
        assertThat(labels).as("Expected at least one ticket label").isNotEmpty();
        String labelId = labels.getFirst().getId();

        CreateTicketInput input = TicketGenerator.createTicketRequest(
                organization.getOrganizationId(),
                device.getMachineId(),
                assigneeId,
                List.of(labelId));

        Ticket ticket = TicketApi.createTicket(input);

        assertThat(ticket).as("Created ticket should not be null").isNotNull();
        assertThat(ticket.getId()).as("Created ticket should have id").isNotNull();
        assertThat(ticket.getTicketNumber()).as("Created ticket should have ticketNumber").isNotNull();
        assertThat(ticket.getTitle()).as("Title should match").isEqualTo(input.getTitle());
        assertThat(ticket.getDescription()).as("Description should match").isEqualTo(input.getDescription());
        assertThat(ticket.getStatus()).as("New ticket should be ACTIVE").isEqualTo("ACTIVE");
        assertThat(ticket.getOrganizationId()).as("organizationId should match").isEqualTo(input.getOrganizationId());
        assertThat(ticket.getDeviceId()).as("deviceId should match").isEqualTo(input.getDeviceId());
        assertThat(ticket.getAssignedTo()).as("assignedTo should match").isEqualTo(assigneeId);
        assertThat(ticket.getOwner()).as("Owner should be present").isNotNull();
        assertThat(ticket.getOwner().getUserId()).as("Owner userId should match assignee").isEqualTo(assigneeId);
        assertThat(ticket.getLabels()).extracting(TicketLabel::getId).as("Label should be attached").contains(labelId);
    }

    @Test
    @DisplayName("Put ticket on hold")
    @Order(2)
    public void testPutTicketOnHold() {
        TicketConnection connection = TicketApi.getTickets(
                TicketGenerator.activeTickets(),
                CursorPaginationInput.builder().limit(1).build(),
                null);
        assertThat(connection.getEdges()).as("Expected at least one ACTIVE ticket").isNotEmpty();
        String ticketId = connection.getEdges().getFirst().getNode().getId();

        Ticket onHold = TicketApi.putTicketOnHold(ticketId);
        assertThat(onHold).as("Returned ticket should not be null").isNotNull();
        assertThat(onHold.getId()).as("Id should match").isEqualTo(ticketId);
        assertThat(onHold.getStatus()).as("Status should be ON_HOLD").isEqualTo("ON_HOLD");
    }

    @Test
    @DisplayName("Resolve ticket")
    @Order(3)
    public void testResolveTicket() {
        TicketConnection connection = TicketApi.getTickets(
                TicketGenerator.activeTickets(),
                CursorPaginationInput.builder().limit(1).build(),
                null);
        assertThat(connection.getEdges()).as("Expected at least one ACTIVE ticket").isNotEmpty();
        String ticketId = connection.getEdges().getFirst().getNode().getId();

        Ticket resolved = TicketApi.resolveTicket(ticketId);
        assertThat(resolved).as("Returned ticket should not be null").isNotNull();
        assertThat(resolved.getId()).as("Id should match").isEqualTo(ticketId);
        assertThat(resolved.getStatus()).as("Status should be RESOLVED").isEqualTo("RESOLVED");
        assertThat(resolved.getResolvedAt()).as("resolvedAt should be set").isNotNull();
    }

    @Test
    @DisplayName("Archive ACTIVE ticket is rejected")
    public void testArchiveActiveTicketRejected() {
        TicketConnection connection = TicketApi.getTickets(
                TicketGenerator.activeTickets(),
                CursorPaginationInput.builder().limit(1).build(),
                null);
        assertThat(connection.getEdges()).as("Expected at least one ACTIVE ticket").isNotEmpty();
        String ticketId = connection.getEdges().getFirst().getNode().getId();

        List<TicketUserError> userErrors = TicketApi.attemptArchiveTicket(ticketId);
        assertThat(userErrors).as("Archiving an ACTIVE ticket should be rejected with userErrors").isNotEmpty();
        assertThat(userErrors).extracting(TicketUserError::getMessage)
                .as("Rejection should mention invalid status transition")
                .anyMatch(msg -> msg != null && msg.contains("Invalid status transition") && msg.contains("ACTIVE") && msg.contains("ARCHIVED"));

        Ticket stillActive = TicketApi.getTicket(ticketId);
        assertThat(stillActive.getStatus()).as("Ticket status must remain ACTIVE").isEqualTo("ACTIVE");
    }

    @Test
    @DisplayName("Archive ticket")
    @Order(4)
    public void testArchiveTicket() {
        TicketConnection connection = TicketApi.getTickets(
                TicketGenerator.activeTickets(),
                CursorPaginationInput.builder().limit(1).build(),
                null);
        assertThat(connection.getEdges()).as("Expected at least one ACTIVE ticket").isNotEmpty();
        String ticketId = connection.getEdges().getFirst().getNode().getId();

        Ticket resolved = TicketApi.resolveTicket(ticketId);
        assertThat(resolved.getStatus()).as("Ticket should be RESOLVED before archiving").isEqualTo("RESOLVED");

        Ticket archived = TicketApi.archiveTicket(ticketId);
        assertThat(archived).as("Returned ticket should not be null").isNotNull();
        assertThat(archived.getId()).as("Id should match").isEqualTo(ticketId);
        assertThat(archived.getStatus()).as("Status should be ARCHIVED").isEqualTo("ARCHIVED");
    }

    @Test
    @DisplayName("Reorder ticket")
    @Order(5)
    public void testReorderTicket() {
        TicketConnection connection = TicketApi.getTickets(
                TicketGenerator.activeTickets(),
                CursorPaginationInput.builder().limit(3).build(),
                null);
        assertThat(connection.getEdges()).as("Expected at least 3 ACTIVE tickets for reorder").hasSizeGreaterThanOrEqualTo(3);
        List<TicketEdge> edges = connection.getEdges();
        String beforeTicketId = edges.get(0).getNode().getId();
        String targetId = edges.get(2).getNode().getId();
        String afterTicketId = edges.get(1).getNode().getId();
        String originalOrder = edges.get(2).getNode().getOrder();

        Ticket reordered = TicketApi.reorderTicket(ReorderTicketInput.builder()
                .id(targetId)
                .afterTicketId(afterTicketId)
                .beforeTicketId(beforeTicketId)
                .build());

        assertThat(reordered).as("Returned ticket should not be null").isNotNull();
        assertThat(reordered.getId()).as("Id should match").isEqualTo(targetId);
        assertThat(reordered.getStatus()).as("Status should remain ACTIVE").isEqualTo("ACTIVE");
        assertThat(reordered.getOrder()).as("Order key should be set").isNotEmpty();
        assertThat(reordered.getOrder()).as("Order key should change after reorder").isNotEqualTo(originalOrder);
    }

    @Tag("saas")
    @Tag("read")
    @Test
    @DisplayName("Get ticket")
    public void testGetTicket() {
        TicketConnection connection = TicketApi.getTickets(
                TicketGenerator.activeTickets(),
                CursorPaginationInput.builder().limit(1).build(),
                null);
        assertThat(connection.getEdges()).as("Expected at least one ticket").isNotEmpty();
        TicketEdge first = connection.getEdges().getFirst();
        Ticket existing = TicketApi.getTicket(first.getNode().getId());
        assertThat(existing).as("Retrieved ticket should not be null").isNotNull();
        assertThat(existing.getId()).as("Ids should match").isEqualTo(first.getNode().getId());
        assertThat(existing.getTicketNumber()).as("ticketNumber should not be null").isNotNull();
        assertThat(existing.getOwner()).as("Owner should be present").isNotNull();
    }
}
