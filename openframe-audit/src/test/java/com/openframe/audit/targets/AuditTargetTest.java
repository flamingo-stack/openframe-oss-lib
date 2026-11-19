package com.openframe.audit.targets;

import com.openframe.data.document.audit.AuditTargetType;
import com.openframe.data.document.ticket.Ticket;
import org.junit.jupiter.api.Test;

import static com.openframe.audit.targets.AuditTarget.TENANT_ID_FIELD;
import static org.assertj.core.api.Assertions.assertThat;

class AuditTargetTest {

    @Test
    void tenantIdOf_recordOfATenant_isThatTenant() {
        assertThat(tickets().tenantIdOf(Ticket.builder().tenantId("tenant-1").build())).isEqualTo("tenant-1");
    }

    @Test
    void keyedByTenant_idFieldIsTheTenantId_returnsTrue() {
        assertThat(tickets().withIdField(TENANT_ID_FIELD).keyedByTenant()).isTrue();
    }

    @Test
    void keyedByTenant_keyedByItsMongoId_returnsFalse() {
        assertThat(tickets().keyedByTenant()).isFalse();
    }

    private static AuditTarget<Ticket> tickets() {
        return AuditTarget.of(AuditTargetType.TICKET, Ticket.class, Ticket::getTitle);
    }
}
