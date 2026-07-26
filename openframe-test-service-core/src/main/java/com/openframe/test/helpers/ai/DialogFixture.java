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

    /** Best-effort teardown: archive the dialog. Safe to call on failure. */
    public void cleanup() {
        try {
            DialogApi.archiveDialog(dialogId);
        } catch (RuntimeException e) {
            log.warn("Failed to archive dialog {}: {}", dialogId, e.getMessage());
        }
    }
}
