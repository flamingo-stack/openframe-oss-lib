package com.openframe.test.tests;

import com.openframe.test.api.DeviceApi;
import com.openframe.test.api.TagApi;
import com.openframe.test.api.TicketApi;
import com.openframe.test.api.AttachmentApi;
import com.openframe.test.api.UserApi;
import com.openframe.test.data.dto.knowledgebase.TempAttachment;
import com.openframe.test.data.dto.shared.MutationDeletePayload;
import com.openframe.test.helpers.ai.RunId;
import com.openframe.test.data.dto.device.Machine;
import com.openframe.test.data.dto.shared.GraphqlError;
import com.openframe.test.data.dto.tag.TagDefinition;
import com.openframe.test.data.dto.ticket.*;
import com.openframe.test.data.dto.user.AuthUser;
import com.openframe.test.data.dto.user.UserRole;
import com.openframe.test.data.generator.TicketGenerator;
import org.junit.jupiter.api.*;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static com.openframe.test.data.generator.CursorGenerator.limit;
import static com.openframe.test.data.generator.DeviceGenerator.offlineDevicesFilter;
import static com.openframe.test.data.generator.DeviceGenerator.onlineDevicesFilter;
import static com.openframe.test.data.generator.KnowledgeBaseGenerator.attachmentFile;
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

    private static final RunId RUN_ID = RunId.next();
    private static final List<Ticket> createdTickets = new ArrayList<>();
    private static final List<String> createdStatusIds = new ArrayList<>();
    /**
     * Staged files, recorded the moment they exist. A staged file is attached to nothing, so an
     * assertion that throws between staging and discarding would leave it in the tenant's storage
     * with no owner to clean it up. Teardown discards whatever is still here.
     */
    private static final List<String> stagedAttachmentIds = new ArrayList<>();

    /** A ticket of this run's own, on the pipeline-scoped device and its organization, with one tag. */
    private static Ticket newOwnTicket(String assigneeId) {
        Machine device = DeviceApi.getAnyDevice(
                pipelineScoped(onlineDevicesFilter()), pipelineScoped(offlineDevicesFilter()));
        assertThat(device).as("Expected at least one device%s", orgSuffix()).isNotNull();
        List<TicketTag> tags = TicketApi.getTicketTags();
        assertThat(tags).as("Expected at least one ticket tag").isNotEmpty();
        Ticket ticket = TicketApi.createTicket(TicketGenerator.createTicketRequest(
                device.getOrganizationId(), device, assigneeId, List.of(tags.getFirst())));
        createdTickets.add(ticket);
        return ticket;
    }

    private static String me() {
        return UserApi.me().getUser().getId();
    }

    @Tag("feature")
    @Test
    @DisplayName("Take over a ticket in one operation")
    @Order(6)
    public void testTakeOverTicket() {
        List<AuthUser> users = UserApi.getUsers(UserRole.ADMIN);
        assertThat(users).as("Expected at least one user").isNotEmpty();
        Ticket created = newOwnTicket(TicketGenerator.assigneeId(users));
        String me = me();
        String techRequiredId = TicketApi.resolveSystemStatusId("TECH_REQUIRED");
        assertThat(techRequiredId).as("No system status definition found for kind TECH_REQUIRED").isNotNull();

        Ticket taken = TicketApi.takeOverTicket(created.getId(), techRequiredId, me);
        assertThat(taken.getId()).as("Id should match").isEqualTo(created.getId());
        assertThat(taken.getStatusDefinition()).as("statusDefinition should be present").isNotNull();
        assertThat(taken.getStatusDefinition().getId()).as("The ticket moved to the requested status").isEqualTo(techRequiredId);
        assertThat(taken.getStatusDefinition().getKind()).as("Status kind should be TECH_REQUIRED").isEqualTo("TECH_REQUIRED");
        assertThat(taken.getAssignedTo()).as("The ticket is assigned to the caller").isEqualTo(me);

        Ticket reread = TicketApi.getTicket(created.getId());
        assertThat(reread.getStatusDefinition().getKind()).as("The status is persisted").isEqualTo("TECH_REQUIRED");
        assertThat(reread.getAssignedTo()).as("The assignment is persisted").isEqualTo(me);

        String archivedId = TicketApi.resolveSystemStatusId("ARCHIVED");
        assertThat(archivedId).as("No system status definition found for kind ARCHIVED").isNotNull();
        List<String> refused = TicketApi.attemptTakeOverTicketMessages(created.getId(), archivedId, me);
        assertThat(refused).as("Taking over straight to ARCHIVED from TECH_REQUIRED is refused").isNotEmpty();
        assertThat(refused.getFirst()).as("The refusal carries a message").isNotBlank();
        Ticket unchanged = TicketApi.getTicket(created.getId());
        assertThat(unchanged.getStatusDefinition().getKind()).as("A refused take-over changes nothing").isEqualTo("TECH_REQUIRED");
        assertThat(unchanged.getAssignedTo()).as("A refused take-over keeps the assignee").isEqualTo(me);
    }

    @Tag("feature")
    @Test
    @DisplayName("Add, edit and delete a ticket note; stage, attach, download and delete a file")
    @Order(7)
    public void testNotesAndAttachments() throws Exception {
        Ticket ticket = newOwnTicket(me());
        String text = "E2E-" + RUN_ID + " note";

        TicketNote note = TicketApi.addNote(ticket.getId(), text);
        assertThat(note.getId()).as("A note has an id").isNotBlank();
        assertThat(note.getTicketId()).as("The note belongs to the ticket").isEqualTo(ticket.getId());
        assertThat(note.getContent()).as("The note content is stored").isEqualTo(text);
        assertThat(note.getAuthorId()).as("The note records its author").isNotBlank();
        assertThat(TicketApi.getTicketDetails(ticket.getId()).getNotes()).extracting(TicketNote::getId)
                .as("The note is on the ticket").contains(note.getId());

        TicketNote edited = TicketApi.updateNote(note.getId(), text + " edited");
        assertThat(edited.getId()).as("Editing keeps the id").isEqualTo(note.getId());
        assertThat(edited.getContent()).as("The content is updated").isEqualTo(text + " edited");
        assertThat(edited.getUpdatedAt()).as("updatedAt is set on edit").isNotNull();

        MutationDeletePayload deletedNote = TicketApi.deleteNote(note.getId());
        assertThat(deletedNote.getUserErrors()).as("Deleting a note reports no userErrors").isNullOrEmpty();
        assertThat(deletedNote.getDeletedId()).as("The deleted note id is echoed").isEqualTo(note.getId());
        assertThat(TicketApi.getTicketDetails(ticket.getId()).getNotes()).extracting(TicketNote::getId)
                .as("The note left the ticket").doesNotContain(note.getId());

        Path file = attachmentFile();
        CreateTempAttachmentInput input = CreateTempAttachmentInput.forFile(file, "text/plain");
        TempAttachment staged = TicketApi.createTempAttachmentUploadUrl(input);
        stagedAttachmentIds.add(staged.getId());
        assertThat(staged.getId()).as("A staged file has an id").isNotBlank();
        assertThat(staged.getUploadUrl()).as("A staged file has a presigned upload URL").isNotBlank();
        assertThat(staged.getFileName()).as("The file name is echoed").isEqualTo(input.getFileName());
        AttachmentApi.uploadAttachmentFile(staged.getUploadUrl(), file, "text/plain");

        Ticket withFile = TicketApi.updateTicket(UpdateTicketInput.builder()
                .id(ticket.getId()).tempAttachmentIds(List.of(staged.getId())).build());
        assertThat(withFile.getAttachments()).as("Linking the staged file attaches it").isNotEmpty();
        TicketAttachment attachment = withFile.getAttachments().stream()
                .filter(a -> input.getFileName().equals(a.getFileName())).findFirst().orElse(null);
        assertThat(attachment).as("The attachment carries the staged file name").isNotNull();
        assertThat(attachment.getFileSize()).as("The attachment carries the file size").isEqualTo(input.getFileSize());

        String downloadUrl = TicketApi.getAttachmentDownloadUrl(attachment.getId());
        assertThat(downloadUrl).as("The attachment has a download URL").isNotBlank();
        assertThat(AttachmentApi.downloadAttachmentFile(downloadUrl))
                .as("The downloaded bytes are the uploaded bytes").isEqualTo(Files.readAllBytes(file));

        MutationDeletePayload deletedAttachment = TicketApi.deleteTicketAttachment(attachment.getId());
        assertThat(deletedAttachment.getUserErrors()).as("Deleting an attachment reports no userErrors").isNullOrEmpty();
        assertThat(deletedAttachment.getDeletedId()).as("The deleted attachment id is echoed").isEqualTo(attachment.getId());
        assertThat(TicketApi.getTicketDetails(ticket.getId()).getAttachments()).extracting(TicketAttachment::getId)
                .as("The attachment left the ticket").doesNotContain(attachment.getId());

        TempAttachment discarded = TicketApi.createTempAttachmentUploadUrl(CreateTempAttachmentInput.forFile(file, "text/plain"));
        stagedAttachmentIds.add(discarded.getId());
        MutationDeletePayload deletedTemp = TicketApi.deleteTempAttachment(discarded.getId());
        assertThat(deletedTemp.getUserErrors()).as("Discarding a staged file reports no userErrors").isNullOrEmpty();
        assertThat(deletedTemp.getDeletedId()).as("The discarded staged file id is echoed").isEqualTo(discarded.getId());
    }

    @Tag("feature")
    @Test
    @DisplayName("Edit, reassign and unlink a ticket")
    @Order(8)
    public void testEditAssignAndUnlink() {
        List<AuthUser> users = UserApi.getUsers(UserRole.ADMIN);
        assertThat(users).as("Expected at least one user").isNotEmpty();
        Ticket ticket = newOwnTicket(TicketGenerator.assigneeId(users));
        assertThat(ticket.getDeviceId()).as("The ticket starts linked to a device").isNotBlank();
        assertThat(ticket.getOrganizationId()).as("The ticket starts linked to an organization").isNotBlank();

        String title = "E2E-" + RUN_ID + " edited";
        Ticket edited = TicketApi.updateTicket(UpdateTicketInput.builder()
                .id(ticket.getId()).title(title).description("edited by the E2E suite").build());
        assertThat(edited.getTitle()).as("The title is updated").isEqualTo(title);
        assertThat(edited.getDescription()).as("The description is updated").isEqualTo("edited by the E2E suite");
        assertThat(edited.getDeviceId()).as("A partial update keeps the device").isEqualTo(ticket.getDeviceId());

        Ticket unassigned = TicketApi.unassignTicket(ticket.getId());
        assertThat(unassigned.getAssignedTo()).as("Unassigning clears the assignee").isNull();
        String me = me();
        Ticket assigned = TicketApi.assignTicket(ticket.getId(), me);
        assertThat(assigned.getAssignedTo()).as("Assigning sets the assignee").isEqualTo(me);

        Ticket noDevice = TicketApi.unlinkDeviceFromTicket(ticket.getId());
        assertThat(noDevice.getDeviceId()).as("Unlinking clears the device").isNull();
        assertThat(noDevice.getOrganizationId()).as("Unlinking the device keeps the organization").isEqualTo(ticket.getOrganizationId());
        Ticket noOrg = TicketApi.unlinkOrganizationFromTicket(ticket.getId());
        assertThat(noOrg.getOrganizationId()).as("Unlinking clears the organization").isNull();

        Ticket reread = TicketApi.getTicketDetails(ticket.getId());
        assertThat(reread.getTitle()).as("The edit is persisted").isEqualTo(title);
        assertThat(reread.getAssignedTo()).as("The assignment is persisted").isEqualTo(me);
        assertThat(reread.getDeviceId()).as("The device unlink is persisted").isNull();
        assertThat(reread.getOrganizationId()).as("The organization unlink is persisted").isNull();
    }

    @Tag("feature")
    @Test
    @DisplayName("Edit and reorder a custom ticket status; read the transition rules and statistics")
    @Order(9)
    public void testStatusDefinitionsRulesAndStatistics() {
        TicketStatusDefinition first = TicketApi.createTicketStatus(TicketGenerator.createStatusRequest());
        TicketStatusDefinition second = TicketApi.createTicketStatus(TicketGenerator.createStatusRequest());
        createdStatusIds.add(first.getId());
        createdStatusIds.add(second.getId());

        TicketStatusDefinition renamed = TicketApi.updateTicketStatus(UpdateTicketStatusInput.builder()
                .id(first.getId()).name(first.getName() + "-edited").color("#22C55E").build());
        assertThat(renamed.getId()).as("Editing keeps the id").isEqualTo(first.getId());
        assertThat(renamed.getName()).as("The name is updated").isEqualTo(first.getName() + "-edited");
        assertThat(renamed.getColor()).as("The color is updated").isEqualTo("#22C55E");
        assertThat(renamed.isSystem()).as("A custom status stays custom").isFalse();

        TicketApi.reorderTicketStatus(ReorderTicketStatusInput.builder().id(first.getId()).afterStatusId(second.getId()).build());
        List<String> order = TicketApi.getTicketStatuses().stream().map(TicketStatusDefinition::getId).toList();
        assertThat(order.indexOf(first.getId())).as("Moved after the second status").isGreaterThan(order.indexOf(second.getId()));
        TicketApi.reorderTicketStatus(ReorderTicketStatusInput.builder().id(first.getId()).beforeStatusId(second.getId()).build());
        order = TicketApi.getTicketStatuses().stream().map(TicketStatusDefinition::getId).toList();
        assertThat(order.indexOf(first.getId())).as("Moved back before the second status").isLessThan(order.indexOf(second.getId()));

        List<TicketStatusTransitionRule> rules = TicketApi.getTransitionRules();
        assertThat(rules).as("The transition matrix is not empty").isNotEmpty();
        assertThat(rules).allSatisfy(rule -> assertThat(rule.getFrom()).as("Every rule names a source status").isNotNull());
        TicketStatusTransitionRule fromResolved = rules.stream()
                .filter(r -> "RESOLVED".equals(r.getFrom().getKind())).findFirst().orElse(null);
        assertThat(fromResolved).as("The matrix has a rule for RESOLVED").isNotNull();
        assertThat(fromResolved.getTo()).extracting(TicketStatusDefinition::getKind)
                .as("RESOLVED may move to ARCHIVED").contains("ARCHIVED");
        TicketStatusTransitionRule fromTech = rules.stream()
                .filter(r -> "TECH_REQUIRED".equals(r.getFrom().getKind())).findFirst().orElse(null);
        assertThat(fromTech).as("The matrix has a rule for TECH_REQUIRED").isNotNull();
        assertThat(fromTech.getTo()).extracting(TicketStatusDefinition::getKind)
                .as("TECH_REQUIRED may not move straight to ARCHIVED (what the take-over case relies on)").doesNotContain("ARCHIVED");

        TicketStatistics stats = TicketApi.getTicketStatistics();
        assertThat(stats.getTotalCount()).as("The tenant has tickets (this class created some)").isGreaterThanOrEqualTo(1);
        assertThat(stats.getStatusDefinitionCounts()).as("Counts per status definition are present").isNotEmpty();
        assertThat(stats.getStatusDefinitionCounts()).allSatisfy(c -> {
            assertThat(c.getStatus()).as("Each count names a status").isNotNull();
            assertThat(c.getCount()).as("Counts are never negative").isGreaterThanOrEqualTo(0);
        });
        int sum = stats.getStatusDefinitionCounts().stream().mapToInt(TicketStatusDefinitionCount::getCount).sum();
        assertThat(sum).as("Per-status counts never exceed the total").isLessThanOrEqualTo(stats.getTotalCount());
    }

    @AfterAll
    public static void cleanupOwnTicketsAndStatuses() {
        for (String id : stagedAttachmentIds) {
            try {
                TicketApi.deleteTempAttachment(id);
            } catch (RuntimeException ignored) {
                // best effort: already discarded by the case, or gone with its ticket
            }
        }
        for (Ticket ticket : createdTickets) {
            try {
                Ticket current = TicketApi.getTicket(ticket.getId());
                String kind = current.getStatusDefinition() == null ? null : current.getStatusDefinition().getKind();
                if (!"RESOLVED".equals(kind) && !"ARCHIVED".equals(kind)) {
                    TicketApi.transitionTicket(ticket.getId(), TicketApi.resolveSystemStatusId("RESOLVED"));
                }
                if (!"ARCHIVED".equals(kind)) {
                    TicketApi.transitionTicket(ticket.getId(), TicketApi.resolveSystemStatusId("ARCHIVED"));
                }
            } catch (RuntimeException ignored) {
                // best effort: a failed cleanup must not mask the case that failed
            }
        }
        for (String id : createdStatusIds) {
            try {
                TicketApi.deleteTicketStatus(id);
            } catch (RuntimeException ignored) {
                // best effort
            }
        }
    }
}
