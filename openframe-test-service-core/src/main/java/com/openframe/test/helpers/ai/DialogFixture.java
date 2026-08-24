package com.openframe.test.helpers.ai;

import com.openframe.test.api.DialogApi;
import com.openframe.test.data.dto.ai.AgentType;
import com.openframe.test.data.dto.ai.CreateDialogRequest;
import com.openframe.test.data.dto.ai.DialogMode;
import com.openframe.test.data.dto.ai.DialogResponse;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;

/**
 * A plain ADMIN/AI dialog to drive the assistant on. The execution target is named in the prompt (by
 * hostname) and the assistant resolves it through its own {@code searchMachines} tool, so the dialog
 * needs no ticket binding — an ADMIN actor can act on any online machine it can locate.
 */
@Slf4j
@Getter
public class DialogFixture {

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
     * <p><b>Known resource leak — tracked defect, no fix here yet.</b> For an AGENT with no
     * {@code ticketId}, the backend auto-creates one ({@code createTicketFromDialog}) and binds the
     * dialog to it — so "the client path needs no ticket" is true of the caller, not of the result.
     * There is no ticket-delete mutation in the API layer, and {@link DialogResponse} does not carry
     * the id back, so {@link #cleanup()} cannot remove it; the tickets accumulate in the test tenant.
     * TODO(test-infra): file/track a defect to either (a) have the backend return the created ticket id
     * on {@link DialogResponse} and expose a delete endpoint so {@link #cleanup()} can remove it, or
     * (b) add a periodic janitor sweep that purges orphaned test-tenant tickets. Until one of these
     * lands, callers of this method should be aware that every invocation leaves a ticket behind and
     * should avoid relying on ticket-count assertions in tests that use it.
     */
    public static DialogFixture openClient() {
        DialogResponse dialog = DialogApi.createDialog(CreateDialogRequest.builder()
                .agentType(AgentType.CLIENT)
                .build());
        log.warn("Created CLIENT dialog {} — a ticket was auto-created for it server-side and cannot be "
                + "cleaned up (no ticket id returned, no delete API); see openClient() Javadoc for tracked defect",
                dialog.getId());
        return new DialogFixture(dialog.getId());
    }

    /** Best-effort teardown: archive the dialog. Safe to call on failure. */
    public void cleanup() {
        try {
            DialogApi.archiveDialog(dialogId);
        } catch (RuntimeException e) {
            log.warn("Failed to archive dialog {}: {}", dialogId, e.getMessage());
        }
    }
}
