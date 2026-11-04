package com.openframe.audit;

import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.document.audit.AuditKind;
import com.openframe.data.document.audit.AuditTargetType;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AuditActionTest {

    private static final List<AuditAction> ACTIONS = Arrays.asList(AuditAction.values());

    @Test
    void everyActionHasAUniqueDottedName() {
        assertThat(ACTIONS).extracting(AuditAction::getName)
                .doesNotHaveDuplicates()
                .allMatch(name -> name.matches("[a-z0-9_]+(\\.[a-z0-9_]+)+"));
    }

    @Test
    void everyActionHasAKind() {
        assertThat(ACTIONS).extracting(AuditAction::getKind).doesNotContainNull();
    }

    @Test
    void onlyTheActionsWithSeveralTargetKindsHaveNoFixedTargetType() {
        assertThat(ACTIONS).filteredOn(action -> action.getTargetType() == null)
                .containsExactlyInAnyOrder(AuditAction.SCRIPT_OUTPUT_VIEW, AuditAction.KB_ITEM_MOVE,
                        AuditAction.KB_ITEM_TAG_ADD, AuditAction.KB_ITEM_TAG_REMOVE, AuditAction.LINK_CREATE,
                        AuditAction.LINK_DELETE);
    }

    @Test
    void sensitiveReadsAreTheTwentyAgreedActions() {
        assertThat(ACTIONS).filteredOn(action -> action.getKind() == AuditKind.SENSITIVE_READ).hasSize(20);
    }

    @Test
    void ticketArchiveIsAChangeOfATicket() {
        assertThat(AuditAction.TICKET_ARCHIVE.getName()).isEqualTo("ticket.archive");
        assertThat(AuditAction.TICKET_ARCHIVE.getKind()).isEqualTo(AuditKind.CHANGE);
        assertThat(AuditAction.TICKET_ARCHIVE.getTargetType()).isEqualTo(AuditTargetType.TICKET);
    }
}
