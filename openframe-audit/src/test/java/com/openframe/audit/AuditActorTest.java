package com.openframe.audit;

import com.openframe.data.document.audit.AuditActor;
import com.openframe.data.document.audit.AuditActorType;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AuditActorTest {

    private static final String SUPER_TENANT_ID = "super-tenant";

    @Test
    void technicianIsUser() {
        AuditActor actor = AuditActor.fromToken(List.of("ADMIN"), "user-1", "anna@acme.com", "tenant-1", null,
                SUPER_TENANT_ID);

        assertThat(actor.type()).isEqualTo(AuditActorType.USER);
        assertThat(actor.id()).isEqualTo("user-1");
        assertThat(actor.email()).isEqualTo("anna@acme.com");
        assertThat(actor.tokenTenantId()).isEqualTo("tenant-1");
        assertThat(actor.isPerson()).isTrue();
    }

    @Test
    void superTenantTokenIsStaff() {
        AuditActor actor = AuditActor.fromToken(List.of("OWNER"), "staff-1", "staff@flamingo.cx", SUPER_TENANT_ID,
                null, SUPER_TENANT_ID);

        assertThat(actor.type()).isEqualTo(AuditActorType.STAFF);
        assertThat(actor.isPerson()).isTrue();
    }

    @Test
    void agentRoleIsDeviceNamedByMachine() {
        AuditActor actor = AuditActor.fromToken(List.of("AGENT"), "client-1", null, "tenant-1", "machine-1",
                SUPER_TENANT_ID);

        assertThat(actor.type()).isEqualTo(AuditActorType.DEVICE);
        assertThat(actor.id()).isEqualTo("machine-1");
        assertThat(actor.email()).isNull();
        assertThat(actor.isPerson()).isFalse();
    }

    @Test
    void systemHasNoIdentity() {
        AuditActor actor = AuditActor.system();

        assertThat(actor.type()).isEqualTo(AuditActorType.SYSTEM);
        assertThat(actor.id()).isNull();
        assertThat(actor.roles()).isEmpty();
        assertThat(actor.isPerson()).isFalse();
    }
}
