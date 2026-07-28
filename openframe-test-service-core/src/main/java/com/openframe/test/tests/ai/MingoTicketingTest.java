package com.openframe.test.tests.ai;

import com.openframe.test.api.OrganizationApi;
import com.openframe.test.api.TicketApi;
import com.openframe.test.data.dto.organization.Organization;
import com.openframe.test.data.dto.ticket.CreateTicketInput;
import com.openframe.test.data.dto.ticket.Ticket;
import com.openframe.test.data.dto.ticket.TicketConnection;
import com.openframe.test.data.dto.ticket.TicketEdge;
import com.openframe.test.helpers.ai.RunId;
import com.openframe.test.helpers.ai.RunResult;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static com.openframe.test.data.generator.CursorGenerator.limit;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * AI assistant ticketing E2E (no machine required). Drives the ADMIN assistant to mutate tickets via its
 * ticket tools (createTicket/updateTicket — each requires an ADMIN approval, which the runner auto-approves),
 * then verifies the persisted entity through the product's own ticket API (channel B = {@link TicketApi}).
 * Assertions are on the stored ticket, never on the assistant's prose.
 *
 * <p>Immune to the searchMachines online-flap that affects device cases — these never touch a machine.
 */
@Tag("ai")
@DisplayName("Mingo — ticketing")
public class MingoTicketingTest extends MingoBaseTest {

    private String createdTicketId;

    @Test
    @Tag("ticket")
    @DisplayName("Mingo creates a ticket")
    public void testTicketCreate() {
        RunId runId = RunId.next();
        String title = "E2E-" + runId;

        RunResult result = prompt("Create a support ticket titled exactly \"" + title
                + "\" describing an office printer that is jammed and offline. If you need to choose an"
                + " organization, pick any available one.");

        Ticket found = findTicketByTitle(title);
        assertThat(found).as("A ticket titled %s should exist in the tenant.\n%s", title, result).isNotNull();
        this.createdTicketId = found.getId();

        // The search projection omits description; re-fetch the full ticket to assert on it.
        Ticket full = TicketApi.getTicket(found.getId());
        assertThat(full.getDescription()).as("Ticket description should be non-empty.\n%s", result).isNotBlank();
    }

    @Test
    @Tag("ticket")
    @DisplayName("Mingo changes a ticket's status")
    public void testTicketStatus() {
        RunId runId = RunId.next();

        // Seed a ticket directly (setup, not under test) so we have a known target and starting status.
        Organization org = OrganizationApi.listOrganizations().getFirst();
        Ticket seed = TicketApi.createTicket(CreateTicketInput.builder()
                .title("E2E-" + runId)
                .description("status-change target")
                .organizationId(org.getOrganizationId())
                .build());
        this.createdTicketId = seed.getId();

        Ticket current = TicketApi.getTicket(seed.getId());
        // Ticket statuses follow a workflow: a freshly-created ticket ("On Hold") transitions to "Resolved".
        // Target that valid transition by its system status id and assert the change landed.
        String resolvedId = TicketApi.resolveSystemStatusId("RESOLVED");
        assertThat(resolvedId).as("Tenant should expose a RESOLVED system status").isNotNull();
        assertThat(current.getStatusDefinition().getId())
                .as("precondition: seeded ticket should not already be Resolved").isNotEqualTo(resolvedId);

        RunResult result = prompt("Change the status of ticket #" + current.getTicketNumber() + " to \"Resolved\".");

        Ticket after = TicketApi.getTicket(seed.getId());
        assertThat(after.getStatusDefinition()).as("Ticket should still have a status.\n%s", result).isNotNull();
        assertThat(after.getStatusDefinition().getId())
                .as("Ticket #%s status should now be Resolved.\n%s", current.getTicketNumber(), result)
                .isEqualTo(resolvedId);
    }

    // ---- helpers ----


    private Ticket findTicketByTitle(String title) {
        TicketConnection conn = TicketApi.getTickets(null, limit(25), title);
        if (conn == null || conn.getEdges() == null) {
            return null;
        }
        return conn.getEdges().stream()
                .map(TicketEdge::getNode)
                .filter(t -> title.equals(t.getTitle()))
                .findFirst()
                .orElse(null);
    }

    @AfterEach
    public void teardown() {
        if (createdTicketId != null) {
            try {
                String resolved = TicketApi.resolveSystemStatusId("RESOLVED");
                if (resolved != null) {
                    TicketApi.transitionTicket(createdTicketId, resolved);
                }
            } catch (RuntimeException ignored) {
                // best-effort cleanup
            }
            createdTicketId = null;
        }
    }
}
