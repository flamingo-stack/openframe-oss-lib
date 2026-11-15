package com.openframe.audit;

import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.document.audit.AuditTargetType;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class AuditCallTest {

    @Test
    void of_actionAndTargetId_takesTheActionsTargetTypeAndNoDetails() {
        AuditCall call = AuditCall.of(AuditAction.TICKET_ARCHIVE, "ticket-1");

        assertThat(call.targetType()).isEqualTo(AuditTargetType.TICKET);
        assertThat(call.targetIdBeforeCall().get()).isEqualTo("ticket-1");
        assertThat(call.detailsFromResult().apply("result")).isEmpty();
    }

    @Test
    void of_targetTypeGiven_keepsItAndTheDetails() {
        AuditCall call = AuditCall.of(AuditAction.TICKET_ARCHIVE, AuditTargetType.KB_ARTICLE, "article-1",
                Map.of("kind", "link"));

        assertThat(call.targetType()).isEqualTo(AuditTargetType.KB_ARTICLE);
        assertThat(call.targetIdBeforeCall().get()).isEqualTo("article-1");
        assertThat(call.detailsFromResult().apply("result")).containsExactlyEntriesOf(Map.of("kind", "link"));
    }

    @Test
    void of_anyCall_comparesAndRecordsEveryResult() {
        AuditCall call = AuditCall.of(AuditAction.TICKET_ARCHIVE, "ticket-1");

        assertThat(call.compare()).isTrue();
        assertThat(call.recordsResult().test("result")).isTrue();
    }

    @Test
    void of_anyCall_takesNoTargetFieldFromTheResult() {
        AuditCall call = AuditCall.of(AuditAction.TICKET_ARCHIVE, "ticket-1");

        assertThat(call.targetIdInResult()).isFalse();
        assertThat(call.targetIdFromResult().apply("result")).isNull();
        assertThat(call.tenantIdOf().apply("result")).isNull();
        assertThat(call.targetNameOf().apply("result")).isNull();
        assertThat(call.organizationIdOf().apply("result")).isNull();
        assertThat(call.deviceIdOf().apply("result")).isNull();
    }
}
