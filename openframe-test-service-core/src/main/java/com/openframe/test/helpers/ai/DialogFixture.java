package com.openframe.test.helpers.ai;

import com.openframe.test.api.ApprovalApi;
import com.openframe.test.api.DialogApi;
import com.openframe.test.api.TicketApi;
import com.openframe.test.data.dto.ai.AgentType;
import com.openframe.test.data.dto.ai.CreateDialogRequest;
import com.openframe.test.data.dto.ai.DialogMode;
import com.openframe.test.data.dto.ai.DialogResponse;
import com.openframe.test.data.dto.shared.GraphqlError;
import com.openframe.test.data.dto.ticket.Ticket;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;

import java.util.List;

/**
 * A plain ADMIN/AI dialog to drive the assistant on. The execution target is named in the prompt (by
 * hostname) and the assistant resolves it through its own {@code searchMachines} tool, so the dialog
 * needs no ticket binding — an ADMIN actor can act on any online machine it can locate.
 */
@Slf4j
@Getter
public class DialogFixture {

    /** The backend's code for a status change refused while an approval on the ticket is pending. */
    private static final String APPROVAL_LOCK = "TICKET_STATUS_LOCKED_BY_APPROVAL";

    private final String dialogId;

    private DialogFixture(String dialogId) {
        this.dialogId = dialogId;
    }

    /** Opens an ADMIN/AI dialog with no ticket. */
    public static DialogFixture open() {
        DialogResponse dialog = DialogApi.createDialog(CreateDialogRequest.builder()
                .agentType(AgentType.ADMIN)
                .mode(DialogMode.AI)
                .build());
        log.info("Created ADMIN/AI dialog {}", dialog.getId());
        return new DialogFixture(dialog.getId());
    }

    /**
     * Opens a CLIENT dialog as the agent — requires an {@link AgentSession} to be open, since the dialog
     * is bound to the caller's {@code machine_id} claim and the backend rejects an AGENT token without one
     * ({@code DialogService.createEmptyDialog}: "AGENT token must contain machineId").
     *
     * <p>No {@code mode} is sent: the backend honours {@code request.mode} only for ADMIN actors and
     * forces {@link DialogMode#AI} for an AGENT, so passing one would just be misleading.
     *
     * <p><b>Creates a ticket server-side.</b> For an AGENT with no {@code ticketId}, the backend
     * auto-creates one ({@code createTicketFromDialog}) and binds the dialog to it — so "the client path
     * needs no ticket" is true of the caller, not of the result. {@link DialogResponse} does not carry
     * the id back, but the dialog does: {@link DialogApi#getDialogTicketId} reads it, and
     * {@link #cleanup()} terminalises it. There is still no ticket-delete mutation, so the best the
     * contract allows is RESOLVED then ARCHIVED.
     */
    public static DialogFixture openClient() {
        DialogResponse dialog = DialogApi.createDialog(CreateDialogRequest.builder()
                .agentType(AgentType.CLIENT)
                .build());
        log.info("Created CLIENT dialog {} (a ticket was auto-created for it server-side)", dialog.getId());
        return new DialogFixture(dialog.getId());
    }

    /**
     * Best-effort teardown: terminalise the ticket the backend bound to this dialog, then archive the
     * dialog. Safe to call on failure.
     *
     * <p>The ticket first, and deliberately. Archiving only the dialog closed the chat and left its
     * ticket live forever: one stage e2e opens 21 CLIENT dialogs, so the test tenants were gaining
     * roughly that many untouchable tickets per run.
     */
    public void cleanup() {
        archiveBoundTicket();
        try {
            DialogApi.archiveDialog(dialogId);
        } catch (RuntimeException e) {
            log.warn("Failed to archive dialog {}: {}", dialogId, e.getMessage());
        }
    }

    /**
     * Walks this dialog's ticket to ARCHIVED. Null for an ADMIN/AI dialog, which has no ticket.
     *
     * <p>Two steps because only RESOLVED may move to ARCHIVED — {@code TicketsTest} asserts that rule
     * in both directions. The kind is re-read between them rather than reused, so a ticket already
     * RESOLVED is not resolved twice and one already ARCHIVED is left alone.
     *
     * <p>{@code AssertionError} is caught as well: the {@code graphqlSuccess()} spec raises one for any
     * GraphQL error, and letting it out of an {@code @AfterEach} fails a case whose body passed.
     */
    private void archiveBoundTicket() {
        try {
            String ticketId = DialogApi.getDialogTicketId(dialogId);
            if (ticketId == null) {
                return;
            }
            if (!isKind(ticketId, "RESOLVED") && !isKind(ticketId, "ARCHIVED")) {
                resolveReleasingApprovalLock(ticketId);
            }
            if (!isKind(ticketId, "ARCHIVED")) {
                TicketApi.transitionTicket(ticketId, TicketApi.resolveSystemStatusId("ARCHIVED"));
            }
            log.info("Archived ticket {} bound to dialog {}", ticketId, dialogId);
        } catch (RuntimeException | AssertionError e) {
            // Best effort: a failed cleanup must not mask the case that failed.
            log.warn("Failed to archive the ticket bound to dialog {}: {}", dialogId, e.getMessage());
        }
    }

    /**
     * Moves the ticket to RESOLVED, first rejecting the approval that freezes it if one does.
     *
     * <p>A run the assistant escalated to technician approval parks its ticket in Tech Required with the
     * request pending, and the backend then refuses every status change with
     * {@code TICKET_STATUS_LOCKED_BY_APPROVAL} until the request is resolved
     * ({@code TicketTransitionPolicyValidator}, oss-lib #2365). Teardown runs as ADMIN, which may resolve
     * an ADMIN-typed request. The refusal names the request, so the transition itself is the probe.
     */
    private static void resolveReleasingApprovalLock(String ticketId) {
        String resolved = TicketApi.resolveSystemStatusId("RESOLVED");
        List<GraphqlError> errors = TicketApi.attemptTransitionTicketErrors(ticketId, resolved);
        if (errors == null || errors.isEmpty()) {
            return;
        }
        String approvalRequestId = errors.stream()
                .map(GraphqlError::getExtensions)
                .filter(ext -> ext != null && APPROVAL_LOCK.equals(ext.get("code")))
                .map(ext -> String.valueOf(ext.get("approvalRequestId")))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Resolving ticket " + ticketId + " was refused: " + errors));
        log.info("Ticket {} is locked by pending approval {}; rejecting it so the ticket can close",
                ticketId, approvalRequestId);
        ApprovalApi.approve(approvalRequestId, false);
        TicketApi.transitionTicket(ticketId, resolved);
    }

    private static boolean isKind(String ticketId, String kind) {
        Ticket ticket = TicketApi.getTicket(ticketId);
        return ticket.getStatusDefinition() != null && kind.equals(ticket.getStatusDefinition().getKind());
    }
}
