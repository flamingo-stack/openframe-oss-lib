package com.openframe.test.tests;

import com.openframe.test.api.DeviceApi;
import com.openframe.test.api.TagApi;
import com.openframe.test.api.TicketApi;
import com.openframe.test.api.UserApi;
import com.openframe.test.data.dto.device.Machine;
import com.openframe.test.data.dto.shared.GraphqlError;
import com.openframe.test.data.dto.tag.TagDefinition;
import com.openframe.test.data.dto.ticket.*;
import com.openframe.test.data.dto.user.AuthUser;
import com.openframe.test.data.dto.user.UserRole;
import com.openframe.test.data.generator.TicketGenerator;
import org.junit.jupiter.api.*;

import java.util.List;

import static com.openframe.test.data.generator.CursorGenerator.limit;
import static com.openframe.test.data.generator.DeviceGenerator.offlineDevicesFilter;
import static com.openframe.test.data.generator.DeviceGenerator.onlineDevicesFilter;
import static com.openframe.test.data.generator.TicketGenerator.activeTickets;
import static org.assertj.core.api.Assertions.assertThat;

@Tag("saas")
@DisplayName("Tickets")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class TicketsTest extends BaseTest {

    @Tag("feature")
    @Tag("saas")
    @Tag("read")
    @Test
    @DisplayName("List tickets")
    public void testListTickets() {
        TicketConnection connection = TicketApi.getTickets(activeTickets(), limit(20));
        assertThat(connection).as("Tickets connection should not be null").isNotNull();
        assertThat(connection.getEdges()).as("Expected at least one ticket").isNotEmpty();
        // No withFailMessage() here on purpose. It overrides the per-field .as() descriptions below,
        // which is what this assertion is worth: the tenant is shared, tickets arrive from the AI cases,
        // the External API suite and every pipeline run, and ticketNumber/title/status are all nullable
        // in the schema (only id is ID!). So a legitimate null is possible, and the failure has to name
        // which field on which ticket -- "Expected tickets to have mandatory fields" alone is not
        // diagnosable from a nightly log, because response bodies are not logged.
        assertThat(connection.getEdges())
                .allSatisfy(edge -> {
                    Ticket ticket = edge.getNode();
                    assertThat(ticket.getId()).as("No Id").isNotNull();
                    assertThat(ticket.getTicketNumber()).as("No ticketNumber for " + ticket.getId()).isNotNull();
                    assertThat(ticket.getTitle()).as("No title for " + ticket.getId()).isNotEmpty();
                    assertThat(ticket.getStatus()).as("No status for " + ticket.getId()).isNotEmpty();
                });
    }

    @Tag("feature")
    @Tag("saas")
    @Tag("read")
    @Test
    @DisplayName("List ticket tags")
    public void testListTicketTags() {
        List<TicketTag> tags = TicketApi.getTicketTags();
        assertThat(tags).as("Expected at least one ticket tag").isNotEmpty();
        assertThat(tags).allSatisfy(tag -> {
            assertThat(tag.getId()).as("No Id").isNotNull();
            assertThat(tag.getKey()).as("No key for " + tag.getId()).isNotEmpty();
        });
    }

    @Tag("feature")
    @Test
    @DisplayName("Reorder ticket")
    @Order(3)
    public void testReorderTicket() {
        // Reorder needs a column with >= 2 tickets. Create ticket (@Order 1) already made one ACTIVE
        // ticket; add a second here (new tickets are ACTIVE too, so both share the ACTIVE column) so the
        // reorder always has two anchors, independent of the tenant's pre-existing ticket state.
        List<AuthUser> reorderAdmins = UserApi.getUsers(UserRole.ADMIN);
        assertThat(reorderAdmins).as("Expected at least one admin user").isNotEmpty();
        String reorderAssigneeId = TicketGenerator.assigneeId(reorderAdmins);

        // Pick a device first (prefer ONLINE) and create under that device's own organization —
        // createTicket rejects a device from a different org. Scoped to the pipeline's org so the
        // ticket lands on the device this run enrolled, rather than on whichever device a shared
        // tenant happens to list first — and so the records it leaves behind stay in the fixture org.
        Machine reorderDevice = DeviceApi.getAnyDevice(
                pipelineScoped(onlineDevicesFilter()), pipelineScoped(offlineDevicesFilter()));
        assertThat(reorderDevice).as("Expected at least one device%s", orgSuffix()).isNotNull();

        List<TicketTag> reorderTags = TicketApi.getTicketTags();
        assertThat(reorderTags).as("Expected at least one ticket tag").isNotEmpty();

        TicketApi.createTicket(TicketGenerator.createTicketRequest(
                reorderDevice.getOrganizationId(), reorderDevice, reorderAssigneeId, List.of(reorderTags.getFirst())));

        // Order ranks are maintained per lifecycle column (statusId), and reorder anchors must belong
        // to the moved ticket's column. Reorder within a single column rather than across the
        // cross-column legacy status filter (whose tickets share per-column base ranks).
        TicketConnection column = TicketApi.findColumnWithAtLeastTwoTickets();
        assertThat(column).as("No ticket status column has at least 2 tickets to reorder").isNotNull();
        Ticket moved = TicketGenerator.lastTicket(column);
        String originalOrder = moved.getOrder();
        String columnStatusId = moved.getStatusDefinition().getId();

        Ticket reordered = TicketApi.reorderTicket(TicketGenerator.moveLastBeforeFirst(column));

        assertThat(reordered).as("Returned ticket should not be null").isNotNull();
        assertThat(reordered.getId()).as("Id should match").isEqualTo(moved.getId());
        assertThat(reordered.getStatusDefinition()).as("statusDefinition should be present").isNotNull();
        assertThat(reordered.getStatusDefinition().getId()).as("Reorder should keep the ticket in its column").isEqualTo(columnStatusId);
        assertThat(reordered.getOrder()).as("Order key should be set").isNotEmpty();
        assertThat(reordered.getOrder()).as("Order key should change after reorder").isNotEqualTo(originalOrder);
    }

    @Tag("feature")
    @Test
    @DisplayName("Create ticket")
    @Order(1)
    public void testCreateTicket() {
        List<AuthUser> users = UserApi.getUsers(UserRole.ADMIN);
        assertThat(users).as("Expected at least one user").isNotEmpty();

        String assigneeId = TicketGenerator.assigneeId(users);

        // Pick a device first (prefer ONLINE) and create the ticket under that device's own organization —
        // createTicket rejects a device that doesn't belong to the selected org. Scoped as above.
        Machine device = DeviceApi.getAnyDevice(
                pipelineScoped(onlineDevicesFilter()), pipelineScoped(offlineDevicesFilter()));
        assertThat(device).as("Expected at least one device%s", orgSuffix()).isNotNull();

        List<TicketTag> tags = TicketApi.getTicketTags();
        assertThat(tags).as("Expected at least one ticket tag").isNotEmpty();
        TicketTag tag = tags.getFirst();

        CreateTicketInput input = TicketGenerator.createTicketRequest(device.getOrganizationId(), device, assigneeId, List.of(tag));

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
        assertThat(ticket.getOwner().getType()).as("Owner type should be ADMIN").isEqualTo("ADMIN");
        assertThat(ticket.getOwner().getUserId()).as("Owner userId should be set").isNotEmpty();
        assertThat(ticket.getTags()).extracting(TicketTag::getId).as("Tag should be attached").contains(tag.getId());
    }

    @Tag("feature")
    @Tag("saas")
    @Tag("read")
    @Test
    @DisplayName("Search ticket")
    @Order(2)
    public void testSearchTicket() {
        TicketConnection all = TicketApi.getTickets(activeTickets(), limit(1));
        assertThat(all.getEdges()).as("Expected at least one ticket to search for").isNotEmpty();
        Ticket existing = TicketGenerator.firstTicket(all);

        TicketConnection found = TicketApi.getTickets(activeTickets(), limit(20), existing.getTitle());
        assertThat(found.getEdges()).as("Search by title should return at least one ticket").isNotEmpty();
        assertThat(found.getEdges()).extracting(edge -> edge.getNode().getId())
                .as("Search results should contain the ticket matched by title")
                .contains(existing.getId());
    }

    @Tag("feature")
    @Test
    @DisplayName("Resolve ticket")
    @Order(4)
    public void testResolveTicket() {
        TicketConnection connection = TicketApi.getTickets(activeTickets(), limit(1));
        assertThat(connection.getEdges()).as("Expected at least one ACTIVE ticket").isNotEmpty();
        String ticketId = TicketGenerator.firstTicketId(connection);

        String resolvedStatusId = TicketApi.resolveSystemStatusId("RESOLVED");
        assertThat(resolvedStatusId).as("No system status definition found for kind RESOLVED").isNotNull();
        Ticket resolved = TicketApi.transitionTicket(ticketId, resolvedStatusId);
        assertThat(resolved).as("Returned ticket should not be null").isNotNull();
        assertThat(resolved.getId()).as("Id should match").isEqualTo(ticketId);
        // Lifecycle is enabled: the source of truth is the status definition, not the
        // legacy `status` enum (which transitionTicket does not sync).
        assertThat(resolved.getStatusDefinition()).as("statusDefinition should be present").isNotNull();
        assertThat(resolved.getStatusDefinition().getId()).as("Should move to the RESOLVED status definition").isEqualTo(resolvedStatusId);
        assertThat(resolved.getStatusDefinition().getKind()).as("Status kind should be RESOLVED").isEqualTo("RESOLVED");
        assertThat(resolved.getResolvedAt()).as("resolvedAt should be set when moving to a RESOLVED-kind status").isNotNull();
    }

    @Tag("feature")
    @Test
    @DisplayName("Archive non-resolved ticket is rejected")
    public void testArchiveActiveTicketRejected() {
        // Only RESOLVED → ARCHIVED is a valid transition. The legacy `status` filter can still surface
        // tickets that have since moved to RESOLVED (transitionTicket does not sync the legacy field),
        // so pick one whose lifecycle status kind is neither RESOLVED nor ARCHIVED.
        TicketConnection connection = TicketApi.getTickets(activeTickets(), limit(20));
        assertThat(connection.getEdges()).as("Expected at least one ACTIVE ticket").isNotEmpty();
        Ticket ticket = TicketGenerator.firstTicketWithStatusKindNotIn(connection, "RESOLVED", "ARCHIVED");
        assertThat(ticket).as("No ticket found with a status kind outside [RESOLVED, ARCHIVED]").isNotNull();
        String ticketId = ticket.getId();
        String kindBefore = ticket.getStatusDefinition().getKind();

        String archivedStatusId = TicketApi.resolveSystemStatusId("ARCHIVED");
        assertThat(archivedStatusId).as("No system status definition found for kind ARCHIVED").isNotNull();
        List<GraphqlError> errors = TicketApi.attemptTransitionTicketErrors(ticketId, archivedStatusId);
        assertThat(errors).as("Transitioning a non-resolved ticket straight to ARCHIVED should be rejected").isNotEmpty();
        assertThat(errors).extracting(error -> error.getExtensions() == null ? null : error.getExtensions().get("code"))
                .as("Rejection should carry the invalid-transition error code")
                .contains("TICKET_INVALID_TRANSITION");

        Ticket unchanged = TicketApi.getTicket(ticketId);
        assertThat(unchanged.getStatusDefinition()).as("statusDefinition should be present").isNotNull();
        assertThat(unchanged.getStatusDefinition().getKind()).as("Status kind must be unchanged after a rejected transition").isEqualTo(kindBefore);
    }

    @Tag("feature")
    @Test
    @DisplayName("Archive ticket")
    @Order(5)
    public void testArchiveTicket() {
        String resolvedStatusId = TicketApi.resolveSystemStatusId("RESOLVED");
        assertThat(resolvedStatusId).as("No system status definition found for kind RESOLVED").isNotNull();
        TicketConnection connection = TicketApi.getTickets(TicketGenerator.ticketsWithStatusId(resolvedStatusId), limit(1));
        assertThat(connection.getEdges()).as("Expected at least one RESOLVED ticket").isNotEmpty();
        String ticketId = TicketGenerator.firstTicketId(connection);

        String archivedStatusId = TicketApi.resolveSystemStatusId("ARCHIVED");
        assertThat(archivedStatusId).as("No system status definition found for kind ARCHIVED").isNotNull();
        Ticket archived = TicketApi.transitionTicket(ticketId, archivedStatusId);
        assertThat(archived).as("Returned ticket should not be null").isNotNull();
        assertThat(archived.getId()).as("Id should match").isEqualTo(ticketId);
        // Lifecycle source of truth is the status definition, not the legacy `status` enum.
        assertThat(archived.getStatusDefinition()).as("statusDefinition should be present").isNotNull();
        assertThat(archived.getStatusDefinition().getId()).as("Should move to the ARCHIVED status definition").isEqualTo(archivedStatusId);
        assertThat(archived.getStatusDefinition().getKind()).as("Status kind should be ARCHIVED").isEqualTo("ARCHIVED");
    }

    @Tag("feature")
    @Test
    @DisplayName("Create ticket status")
    @Order(7)
    public void testCreateTicketStatus() {
        CreateTicketStatusInput input = TicketGenerator.createStatusRequest();

        TicketStatusDefinition created = TicketApi.createTicketStatus(input);
        assertThat(created).as("Created status should not be null").isNotNull();
        assertThat(created.getId()).as("Created status should have an id").isNotNull();
        assertThat(created.getName()).as("Name should match").isEqualTo(input.getName());
        assertThat(created.getColor()).as("Color should match").isEqualTo(input.getColor());
        assertThat(created.getKind()).as("Custom status kind should be CUSTOM").isEqualTo("CUSTOM");
        assertThat(created.isSystem()).as("Custom status should not be a system status").isFalse();

        assertThat(TicketApi.getTicketStatuses()).extracting(TicketStatusDefinition::getId)
                .as("Created status should appear in ticketStatuses").contains(created.getId());

        // Clean up so repeated runs don't accumulate custom statuses.
        assertThat(TicketApi.deleteTicketStatus(created.getId())).as("Cleanup delete should succeed").isTrue();
    }

    @Tag("feature")
    @Test
    @DisplayName("Delete ticket status")
    @Order(8)
    public void testDeleteTicketStatus() {
        TicketStatusDefinition created = TicketApi.createTicketStatus(TicketGenerator.createStatusRequest());
        assertThat(created.getId()).as("Created status should have an id").isNotNull();

        boolean deleted = TicketApi.deleteTicketStatus(created.getId());
        assertThat(deleted).as("Deleting an unused custom status should return true").isTrue();

        assertThat(TicketApi.getTicketStatuses()).extracting(TicketStatusDefinition::getId)
                .as("Deleted status should no longer appear in ticketStatuses").doesNotContain(created.getId());
    }

    @Tag("feature")
    @Test
    @DisplayName("Delete system status is rejected")
    public void testDeleteSystemStatusRejected() {
        String resolvedStatusId = TicketApi.resolveSystemStatusId("RESOLVED");
        assertThat(resolvedStatusId).as("No system status definition found for kind RESOLVED").isNotNull();

        List<GraphqlError> errors = TicketApi.attemptDeleteTicketStatusErrors(resolvedStatusId);
        assertThat(errors).as("Deleting a system status should be rejected").isNotEmpty();
        assertThat(errors).extracting(error -> error.getExtensions() == null ? null : error.getExtensions().get("code"))
                .as("Rejection should carry the system-protected error code")
                .contains("TICKET_STATUS_SYSTEM_PROTECTED");

        assertThat(TicketApi.getTicketStatuses()).extracting(TicketStatusDefinition::getId)
                .as("System status must still exist after a rejected delete").contains(resolvedStatusId);
    }

    @Tag("feature")
    @Tag("saas")
    @Tag("read")
    @Test
    @DisplayName("Get ticket")
    public void testGetTicket() {
        TicketConnection connection = TicketApi.getTickets(activeTickets(), limit(1));
        assertThat(connection.getEdges()).as("Expected at least one ticket").isNotEmpty();
        String ticketId = TicketGenerator.firstTicketId(connection);

        Ticket existing = TicketApi.getTicket(ticketId);
        assertThat(existing).as("Retrieved ticket should not be null").isNotNull();
        assertThat(existing.getId()).as("Ids should match").isEqualTo(ticketId);
        assertThat(existing.getTicketNumber()).as("ticketNumber should not be null").isNotNull();
        assertThat(existing.getOwner()).as("Owner should be present").isNotNull();
    }

    // Tagged `feature` as a fixture, not for its own sake: three feature cases below read
    // getTicketTags() and would find it empty on a tenant this has never run against.
    @Tag("feature")
    @Tag("saas")
    @Test
    @Order(0)   // before Create ticket (@Order 1): seeds a TICKET tag so getTicketTags() is non-empty
    @DisplayName("Create ticket tag")
    public void testCreateTicketTag() {
        // createTag is idempotent per (key, entityType): re-running returns the existing tag, so a
        // fixed key keeps the environment from accumulating tags.
        String key = "QA_TICKET_TAG";

        TagDefinition tag = TagApi.createTag(key, "TICKET", null, null);

        assertThat(tag).as("Created tag should not be null").isNotNull();
        assertThat(tag.getId()).as("Created tag id should not be blank").isNotBlank();
        assertThat(tag.getKey()).as("Tag key should match input").isEqualTo(key);
        assertThat(tag.getEntityType()).as("Tag entityType should be TICKET").isEqualTo("TICKET");
        assertThat(tag.getCreatedAt()).as("Tag createdAt should not be blank").isNotBlank();
    }
}
