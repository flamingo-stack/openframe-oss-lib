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
        AuditActor actor = AuditActor.fromUser("user-1", "anna@acme.com", List.of("ADMIN"), "tenant-1",
                SUPER_TENANT_ID);

        assertThat(actor.type()).isEqualTo(AuditActorType.USER);
        assertThat(actor.id()).isEqualTo("user-1");
        assertThat(actor.email()).isEqualTo("anna@acme.com");
        assertThat(actor.tokenTenantId()).isEqualTo("tenant-1");
        assertThat(actor.onBehalfOfId()).isNull();
    }

    @Test
    void superTenantTokenIsStaff() {
        AuditActor actor = AuditActor.fromUser("staff-1", "staff@flamingo.cx", List.of("OWNER"), SUPER_TENANT_ID,
                SUPER_TENANT_ID);

        assertThat(actor.type()).isEqualTo(AuditActorType.STAFF);
    }

    @Test
    void nobodyIsStaffWhereNoSuperTenantIsConfigured() {
        AuditActor actor = AuditActor.fromUser("user-1", "owner@acme.com", List.of("OWNER"), "oss", "");

        assertThat(actor.type()).isEqualTo(AuditActorType.USER);
    }

    @Test
    void agentRoleIsDeviceNamedByMachine() {
        AuditActor actor = AuditActor.fromAgent("machine-1", List.of("AGENT"), "tenant-1");

        assertThat(actor.type()).isEqualTo(AuditActorType.DEVICE);
        assertThat(actor.id()).isEqualTo("machine-1");
        assertThat(actor.email()).isNull();
    }

    @Test
    void apiKeyActsForItsOwner() {
        AuditActor actor = AuditActor.fromApiKey("key-1", "Billing sync", List.of("ADMIN"), "tenant-1", "user-1");

        assertThat(actor.type()).isEqualTo(AuditActorType.API_KEY);
        assertThat(actor.id()).isEqualTo("key-1");
        assertThat(actor.name()).isEqualTo("Billing sync");
        assertThat(actor.roles()).containsExactly("ADMIN");
        assertThat(actor.onBehalfOfId()).isEqualTo("user-1");
        assertThat(AuditActor.fromApiKey("key-2", null, null, null, "user-1").roles()).isEmpty();
    }

    @Test
    void systemHasNoIdentity() {
        AuditActor actor = AuditActor.system();

        assertThat(actor.type()).isEqualTo(AuditActorType.SYSTEM);
        assertThat(actor.id()).isNull();
        assertThat(actor.roles()).isEmpty();
    }

    @Test
    void tenantIsTheRequestedOneThenTheTokensThenTheServedOne() {
        AuditActor technician = AuditActor.fromUser("user-1", null, List.of("ADMIN"), "tenant-1", SUPER_TENANT_ID);
        AuditActor staff = AuditActor.fromUser("staff-1", null, List.of("ADMIN"), SUPER_TENANT_ID, SUPER_TENANT_ID);

        assertThat(technician.tenantFor("tenant-2", SUPER_TENANT_ID, () -> "served")).isEqualTo("tenant-2");
        assertThat(technician.tenantFor(null, SUPER_TENANT_ID, () -> "served")).isEqualTo("tenant-1");
        assertThat(staff.tenantFor(null, SUPER_TENANT_ID, () -> "served")).isEqualTo("served");
        assertThat(AuditActor.system().tenantFor(" ", SUPER_TENANT_ID, () -> "served")).isEqualTo("served");
    }
}
