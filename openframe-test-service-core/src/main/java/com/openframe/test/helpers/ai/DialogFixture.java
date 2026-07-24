package com.openframe.test.helpers.ai;

import com.openframe.test.api.DialogApi;
import com.openframe.test.api.OrganizationApi;
import com.openframe.test.api.TicketApi;
import com.openframe.test.api.UserApi;
import com.openframe.test.context.PipelineContext;
import com.openframe.test.data.dto.ai.AgentType;
import com.openframe.test.data.dto.ai.CreateDialogRequest;
import com.openframe.test.data.dto.ai.DialogMode;
import com.openframe.test.data.dto.ai.DialogResponse;
import com.openframe.test.data.dto.device.Machine;
import com.openframe.test.data.dto.organization.Organization;
import com.openframe.test.data.dto.ticket.CreateTicketInput;
import com.openframe.test.data.dto.ticket.Ticket;
import com.openframe.test.data.dto.ticket.TicketLabel;
import com.openframe.test.data.dto.user.AuthUser;
import com.openframe.test.data.dto.user.UserRole;
import com.openframe.test.data.generator.TicketGenerator;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;

import java.util.List;

/**
 * Establishes the machine execution target the way a technician does: an ADMIN dialog linked to a ticket
 * whose {@code deviceId} is the target machine.
 *
 * <p><b>Why a ticket:</b> {@code SendMessageRequest} has no {@code machineId}. For an ADMIN actor the AI
 * agent resolves the target as {@code dialog.ticketId -> Ticket.deviceId} (MachineIdResolverService).
 * A DEVICE context item only enriches prompt text; it does not set the target. So the dialog must carry
 * a ticket bound to the target device.
 */
@Slf4j
@Getter
public class DialogFixture {

    private final String dialogId;
    private final String ticketId;

    private DialogFixture(String dialogId, String ticketId) {
        this.dialogId = dialogId;
        this.ticketId = ticketId;
    }

    /** Creates a ticket bound to {@code device} and an ADMIN/AI dialog linked to it. */
    public static DialogFixture forMachine(Machine device, RunId runId) {
        List<AuthUser> admins = UserApi.getUsers(UserRole.ADMIN);
        if (admins.isEmpty()) {
            throw new IllegalStateException("No ADMIN user available to own the targeting ticket");
        }
        String assigneeId = TicketGenerator.assigneeId(admins);

        List<Organization> orgs = OrganizationApi.listOrganizations();
        if (orgs.isEmpty()) {
            throw new IllegalStateException("No organization available for the targeting ticket");
        }
        Organization organization = PipelineContext.hasOrgId()
                ? orgs.stream()
                        .filter(o -> PipelineContext.getOrgId().equals(o.getOrganizationId()))
                        .findFirst()
                        .orElse(orgs.getFirst())
                : orgs.getFirst();

        List<TicketLabel> labels = TicketApi.getTicketLabels();
        List<TicketLabel> firstLabel = labels.isEmpty() ? List.of() : List.of(labels.getFirst());

        CreateTicketInput input = TicketGenerator.createTicketRequest(organization, device, assigneeId, firstLabel);
        input.setTitle(runId + " AI E2E targeting ticket");
        Ticket ticket = TicketApi.createTicket(input);
        log.info("Created targeting ticket {} bound to device {}", ticket.getId(), device.getMachineId());

        DialogResponse dialog = DialogApi.createDialog(CreateDialogRequest.builder()
                .agentType(AgentType.ADMIN)
                .ticketId(ticket.getId())
                .mode(DialogMode.AI)
                .build());
        log.info("Created ADMIN/AI dialog {} on ticket {}", dialog.getId(), ticket.getId());

        return new DialogFixture(dialog.getId(), ticket.getId());
    }

    /** Best-effort teardown: archive the dialog and move the ticket out of the active board. Safe on failure. */
    public void cleanup() {
        try {
            DialogApi.archiveDialog(dialogId);
        } catch (RuntimeException e) {
            log.warn("Failed to archive dialog {}: {}", dialogId, e.getMessage());
        }
        try {
            String resolvedStatusId = TicketApi.resolveSystemStatusId("RESOLVED");
            if (resolvedStatusId != null) {
                TicketApi.transitionTicket(ticketId, resolvedStatusId);
            }
        } catch (RuntimeException e) {
            log.warn("Failed to resolve targeting ticket {}: {}", ticketId, e.getMessage());
        }
    }
}
