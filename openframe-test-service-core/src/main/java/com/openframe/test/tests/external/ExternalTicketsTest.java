package com.openframe.test.tests.external;

import com.openframe.test.api.external.ExternalTicketApi;
import com.openframe.test.data.dto.external.common.ExternalErrorResponse;
import com.openframe.test.data.dto.external.ticket.CreateTicketRequest;
import com.openframe.test.data.dto.external.ticket.TicketFilterOptionResponse;
import com.openframe.test.data.dto.external.ticket.TicketFiltersResponse;
import com.openframe.test.data.dto.external.ticket.TicketNoteResponse;
import com.openframe.test.data.dto.external.ticket.TicketResponse;
import com.openframe.test.data.dto.external.ticket.TicketStatisticsResponse;
import com.openframe.test.data.dto.external.ticket.TicketStatusResponse;
import com.openframe.test.data.dto.external.ticket.TicketTagResponse;
import com.openframe.test.data.dto.external.ticket.TicketsResponse;
import com.openframe.test.data.dto.external.ticket.UpdateTicketRequest;
import com.openframe.test.data.generator.external.ExternalTicketGenerator;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.condition.EnabledIf;

import java.util.List;
import java.util.Map;

import static com.openframe.test.data.generator.external.ExternalTicketGenerator.noteContent;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@code /api/v1/tickets} — 18 operations, the largest surface on the External API.
 *
 * <p>Tickets are the only External API resource whose controller resolves a principal, from the
 * {@code X-User-Id} the gateway derives from the key. So unlike the other suites these calls act as a
 * specific user, and the note cases exercise the author-only rules that follow from it.
 *
 * <p>There is no delete on this API. {@link #cleanup()} transitions what it created into the archived
 * status instead — the strongest cleanup available.
 */
@Tag("saas")
@Tag("external-api")
@EnabledIf(ExternalApiBaseTest.EXTERNAL_API_KEY_CONDITION)
@DisplayName("External API - Tickets")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@Slf4j
public class ExternalTicketsTest extends ExternalApiBaseTest {

    private static final String UNKNOWN_ID = "000000000000000000000000";
    private static final String ARCHIVED_KIND = "ARCHIVED";

    private static TicketResponse created;
    private static TicketNoteResponse note;

    /** Archive what we created; there is no delete, so this is as clean as the contract allows. */
    @AfterAll
    public static void cleanup() {
        if (created == null) {
            return;
        }
        try {
            ExternalTicketApi.getStatuses().stream()
                    .filter(status -> ARCHIVED_KIND.equals(status.getKind()))
                    .findFirst()
                    .ifPresent(archived -> ExternalTicketApi.transitionRaw(
                            created.getId(), archived.getId(), "extapi suite teardown"));
        } catch (Exception e) {
            log.warn("Could not archive ticket {} during teardown: {}", created.getId(), e.getMessage());
        }
    }

    // --- lifecycle ---------------------------------------------------------------------------

    @Tag("feature")
    @Tag("create")
    @Order(1)
    @Test
    @DisplayName("Create ticket")
    public void testCreateTicket() {
        CreateTicketRequest request = ExternalTicketGenerator.createTicketRequest();
        created = ExternalTicketApi.createTicket(request);

        assertThat(created.getId()).as("Ticket id should not be null").isNotNull();
        assertThat(created.getTicketNumber()).as("Ticket should be assigned a number").isNotNull();
        assertThat(created.getTitle()).as("Title should be echoed back").isEqualTo(request.getTitle());
        assertThat(created.getDescription()).as("Description should be echoed back")
                .isEqualTo(request.getDescription());
        assertThat(created.getStatus()).as("A new ticket should have a status").isNotNull();
        assertThat(created.getStatusDefinition()).as("A new ticket should resolve a status definition")
                .isNotNull();
        assertThat(created.getCreatedAt()).as("Ticket createdAt should not be null").isNotNull();
    }

    @Tag("feature")
    @Tag("read")
    @Order(2)
    @Test
    @DisplayName("Get ticket by ID")
    public void testGetTicket() {
        TicketResponse fetched = ExternalTicketApi.getTicket(created.getId());

        assertThat(fetched.getId()).as("Fetched ticket should be the one requested").isEqualTo(created.getId());
        assertThat(fetched.getTitle()).as("Title should match").isEqualTo(created.getTitle());
        // The single read is documented to hydrate collections the list projection leaves out.
        assertThat(fetched.getTags()).as("Single read should materialise tags").isNotNull();
        assertThat(fetched.getNotes()).as("Single read should materialise notes").isNotNull();
        assertThat(fetched.getAttachments()).as("Single read should materialise attachments").isNotNull();
    }

    @Tag("feature")
    @Tag("read")
    @Order(3)
    @Test
    @DisplayName("Created ticket appears in the list")
    public void testCreatedTicketIsListed() {
        TicketsResponse response = ExternalTicketApi
                .listTickets(Map.of("search", created.getTitle(), "limit", 20));

        assertThat(response.getPageInfo()).as("Paginated response should carry pageInfo").isNotNull();
        assertThat(response.getTickets()).as("Searching for the created ticket's title should find it")
                .anySatisfy(ticket -> assertThat(ticket.getId()).isEqualTo(created.getId()));
    }

    @Tag("feature")
    @Tag("update")
    @Order(4)
    @Test
    @DisplayName("Update ticket")
    public void testUpdateTicket() {
        UpdateTicketRequest request = ExternalTicketGenerator.updateTicketRequest();
        TicketResponse updated = ExternalTicketApi.updateTicket(created.getId(), request);

        assertThat(updated.getId()).as("Update should not change the id").isEqualTo(created.getId());
        assertThat(updated.getTitle()).as("Title should be updated").isEqualTo(request.getTitle());
        assertThat(updated.getDescription()).as("Description should be updated")
                .isEqualTo(request.getDescription());
        assertThat(updated.getTicketNumber()).as("Update should not renumber the ticket")
                .isEqualTo(created.getTicketNumber());

        created = updated;
    }

    // --- reference data ---------------------------------------------------------------------

    @Tag("feature")
    @Tag("read")
    @Order(5)
    @Test
    @DisplayName("Get ticket statuses")
    public void testGetStatuses() {
        List<TicketStatusResponse> statuses = ExternalTicketApi.getStatuses();

        assertThat(statuses).as("A tenant always has lifecycle statuses").isNotEmpty();
        assertThat(statuses).allSatisfy(status -> {
            assertThat(status.getId()).as("Status id should not be null").isNotNull();
            assertThat(status.getName()).as("Status name should not be empty").isNotEmpty();
            assertThat(status.getKind()).as("Status kind should not be null").isNotNull();
        });
        assertThat(statuses).as("The archived status is what teardown depends on")
                .anySatisfy(status -> assertThat(status.getKind()).isEqualTo(ARCHIVED_KIND));
    }

    @Tag("feature")
    @Tag("read")
    @Order(6)
    @Test
    @DisplayName("Get ticket tags")
    public void testGetTags() {
        List<TicketTagResponse> tags = ExternalTicketApi.getTags();

        assertThat(tags).as("Tags collection should be present, even if empty").isNotNull();
        assertThat(tags).allSatisfy(tag -> {
            assertThat(tag.getId()).as("Tag id should not be null").isNotNull();
            assertThat(tag.getKey()).as("Tag key should not be empty").isNotEmpty();
        });
    }

    @Tag("feature")
    @Tag("read")
    @Order(7)
    @Test
    @DisplayName("Get ticket filter options")
    public void testGetFilters() {
        TicketFiltersResponse filters = ExternalTicketApi.getFilters();

        assertThat(filters).as("Filter response should not be null").isNotNull();
        assertOptions(filters.getStatuses(), "statuses");
        assertOptions(filters.getCustomerIds(), "customerIds");
        assertOptions(filters.getAssigneeIds(), "assigneeIds");
        assertOptions(filters.getTagIds(), "tagIds");
    }

    @Tag("feature")
    @Tag("read")
    @Order(8)
    @Test
    @DisplayName("Get ticket statistics")
    public void testGetStatistics() {
        TicketStatisticsResponse statistics = ExternalTicketApi.getStatistics();

        assertThat(statistics.getTotalCount()).as("Total count should not be negative")
                .isGreaterThanOrEqualTo(0);
        if (statistics.getStatusCounts() != null) {
            assertThat(statistics.getStatusCounts()).allSatisfy(count -> {
                assertThat(count.getStatus()).as("Status count should name a status").isNotNull();
                assertThat(count.getCount()).as("Status count should not be negative")
                        .isGreaterThanOrEqualTo(0);
            });
            // Per-status counts partition the same set the total counts, so the parts cannot exceed it.
            int summed = statistics.getStatusCounts().stream()
                    .mapToInt(count -> count.getCount() == null ? 0 : count.getCount())
                    .sum();
            assertThat(summed).as("Per-status counts should not exceed the reported total")
                    .isLessThanOrEqualTo(statistics.getTotalCount());
        }
    }

    // --- tags -------------------------------------------------------------------------------

    @Tag("feature")
    @Tag("update")
    @Order(9)
    @Test
    @DisplayName("Add and remove a tag")
    public void testAddAndRemoveTag() {
        List<TicketTagResponse> tags = ExternalTicketApi.getTags();
        if (tags.isEmpty()) {
            log.info("Tenant has no ticket tags; skipping the tag cases");
            return;
        }

        String tagId = tags.getFirst().getId();
        TicketResponse tagged = ExternalTicketApi.addTag(created.getId(), tagId);
        assertThat(tagged.getTags()).as("Added tag should be attached to the ticket")
                .anySatisfy(tag -> assertThat(tag.getId()).isEqualTo(tagId));

        TicketResponse untagged = ExternalTicketApi.removeTag(created.getId(), tagId);
        assertThat(untagged.getTags()).as("Removed tag should be gone from the ticket")
                .noneSatisfy(tag -> assertThat(tag.getId()).isEqualTo(tagId));
    }

    // --- assignment -------------------------------------------------------------------------

    @Tag("feature")
    @Tag("update")
    @Order(10)
    @Test
    @DisplayName("Assign and unassign a ticket")
    public void testAssignAndUnassign() {
        List<TicketFilterOptionResponse> assignees = ExternalTicketApi.getFilters().getAssigneeIds();
        if (assignees == null || assignees.isEmpty()) {
            log.info("No assignable users advertised on this tenant; skipping the assignment cases");
            return;
        }

        String assigneeId = assignees.getFirst().getValue();
        TicketResponse assigned = ExternalTicketApi.assign(created.getId(), assigneeId);
        assertThat(assigned.getAssignedTo()).as("Ticket should record the assignee").isEqualTo(assigneeId);

        TicketResponse unassigned = ExternalTicketApi.unassign(created.getId());
        assertThat(unassigned.getAssignedTo()).as("Ticket should have no assignee after unassign").isNull();
    }

    // --- notes ------------------------------------------------------------------------------

    @Tag("feature")
    @Tag("create")
    @Order(11)
    @Test
    @DisplayName("Add an internal note")
    public void testAddNote() {
        String content = noteContent();
        note = ExternalTicketApi.addNote(created.getId(), content);

        assertThat(note.getId()).as("Note id should not be null").isNotNull();
        assertThat(note.getContent()).as("Note content should be echoed back").isEqualTo(content);
        assertThat(note.getTicketId()).as("Note should belong to the ticket").isEqualTo(created.getId());
        assertThat(note.getCreatedAt()).as("Note createdAt should not be null").isNotNull();
        // Notes are the clearest evidence the ticket endpoints resolve a real principal: the author is
        // taken from the key's user, never from the request.
        assertThat(note.getAuthorId()).as("Note should record an author resolved from the API key")
                .isNotNull();
    }

    @Tag("feature")
    @Tag("update")
    @Order(12)
    @Test
    @DisplayName("Update a note")
    public void testUpdateNote() {
        String content = noteContent();
        TicketNoteResponse updated = ExternalTicketApi.updateNote(created.getId(), note.getId(), content);

        assertThat(updated.getId()).as("Update should not change the note id").isEqualTo(note.getId());
        assertThat(updated.getContent()).as("Note content should be updated").isEqualTo(content);
    }

    @Tag("feature")
    @Tag("read")
    @Order(13)
    @Test
    @DisplayName("Note is visible on the ticket")
    public void testNoteIsOnTicket() {
        assertThat(ExternalTicketApi.getTicket(created.getId()).getNotes())
                .as("The added note should appear on the ticket")
                .anySatisfy(existing -> assertThat(existing.getId()).isEqualTo(note.getId()));
    }

    @Tag("feature")
    @Tag("delete")
    @Order(14)
    @Test
    @DisplayName("Delete a note")
    public void testDeleteNote() {
        ExternalTicketApi.deleteNote(created.getId(), note.getId());

        assertThat(ExternalTicketApi.getTicket(created.getId()).getNotes())
                .as("The deleted note should be gone from the ticket")
                .noneSatisfy(existing -> assertThat(existing.getId()).isEqualTo(note.getId()));
    }

    // --- transitions and unlinking ----------------------------------------------------------

    @Tag("feature")
    @Tag("update")
    @Order(15)
    @Test
    @DisplayName("Transition ticket to another status")
    public void testTransitionTicket() {
        TicketResponse current = ExternalTicketApi.getTicket(created.getId());
        List<TicketStatusResponse> available = current.getAvailableTransitions();
        if (available == null || available.isEmpty()) {
            log.info("Ticket {} advertises no available transitions; skipping", created.getId());
            return;
        }

        // Only an advertised transition is asserted to succeed; availableTransitions is the contract's
        // statement of what is legal from here.
        TicketStatusResponse target = available.getFirst();
        TicketResponse transitioned = ExternalTicketApi
                .transition(created.getId(), target.getId(), "extapi suite transition");

        assertThat(transitioned.getStatusDefinition()).as("Transitioned ticket should resolve a status")
                .isNotNull();
        assertThat(transitioned.getStatusDefinition().getId())
                .as("Ticket should now be in the requested status").isEqualTo(target.getId());

        created = transitioned;
    }

    @Tag("feature")
    @Tag("update")
    @Order(16)
    @Test
    @DisplayName("Unlink device and customer")
    public void testUnlinkDeviceAndCustomer() {
        TicketResponse withoutDevice = ExternalTicketApi.unlinkDevice(created.getId());
        assertThat(withoutDevice.getDeviceId()).as("Device should be unlinked from the ticket").isNull();

        TicketResponse withoutCustomer = ExternalTicketApi.unlinkCustomer(created.getId());
        assertThat(withoutCustomer.getCustomerId()).as("Customer should be unlinked from the ticket")
                .isNull();

        created = withoutCustomer;
    }

    // --- negative cases ---------------------------------------------------------------------

    @Tag("feature")
    @Tag("read")
    @Order(17)
    @Test
    @DisplayName("Get ticket returns 404 for an unknown ID")
    public void testGetUnknownTicket() {
        ExternalErrorResponse error = ExternalTicketApi.attemptGetTicket(UNKNOWN_ID, 404);
        assertThat(error.getCode()).as("Unknown ticket should report an error code").isNotNull();
    }

    @Tag("feature")
    @Tag("create")
    @Order(18)
    @Test
    @DisplayName("Create ticket rejects a missing title")
    public void testCreateTicketRequiresTitle() {
        CreateTicketRequest request = ExternalTicketGenerator.createTicketRequest();
        request.setTitle(null);

        ExternalErrorResponse error = ExternalTicketApi.attemptCreateTicket(request, 400);
        assertThat(error.getCode()).as("Validation failure should carry an error code").isNotNull();
    }

    @Tag("feature")
    @Tag("create")
    @Order(19)
    @Test
    @DisplayName("Create ticket rejects an over-long title")
    public void testCreateTicketRejectsOverlongTitle() {
        CreateTicketRequest request = ExternalTicketGenerator.createTicketRequest();
        request.setTitle(ExternalTicketGenerator.overlongTitle());

        ExternalErrorResponse error = ExternalTicketApi.attemptCreateTicket(request, 400);
        assertThat(error.getCode()).as("Exceeding the documented %d-character title limit should be a 400",
                ExternalTicketGenerator.MAX_TITLE_LENGTH).isNotNull();
    }

    private static void assertOptions(List<TicketFilterOptionResponse> options, String name) {
        if (options == null) {
            return;
        }
        assertThat(options).as("%s filter options should each carry a value", name)
                .allSatisfy(option -> assertThat(option.getValue()).isNotNull());
    }
}
