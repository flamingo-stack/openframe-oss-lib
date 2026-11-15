package com.openframe.data.model.audit;

import com.openframe.data.document.audit.AuditActorType;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AuditActorTest {

    private static final String SUPER_TENANT_ID = "super-tenant";
    private static final String SERVED_TENANT_ID = "served-tenant";
    private static final AuditActor TECHNICIAN = AuditActor.fromUser("user-1", null, List.of("ADMIN"), "tenant-1",
            SUPER_TENANT_ID);

    @Test
    void fromUser_technicianToken_isUserWithTheTokensFacts() {
        assertThat(AuditActor.fromUser("user-1", "anna@acme.com", List.of("ADMIN"), "tenant-1", SUPER_TENANT_ID))
                .returns(AuditActorType.USER, AuditActor::type)
                .returns("user-1", AuditActor::id)
                .returns("anna@acme.com", AuditActor::email)
                .returns(List.of("ADMIN"), AuditActor::roles)
                .returns("tenant-1", AuditActor::tokenTenantId);
    }

    @Test
    void fromUser_superTenantToken_isStaff() {
        AuditActor actor = AuditActor.fromUser("staff-1", "staff@flamingo.cx", List.of("OWNER"), SUPER_TENANT_ID,
                SUPER_TENANT_ID);

        assertThat(actor.type()).isEqualTo(AuditActorType.STAFF);
    }

    @Test
    void fromUser_noSuperTenantConfigured_isUser() {
        AuditActor actor = AuditActor.fromUser("user-1", "owner@acme.com", List.of("OWNER"), "oss", "");

        assertThat(actor.type()).isEqualTo(AuditActorType.USER);
    }

    @Test
    void fromAgent_agentToken_isDeviceWithTheTokensFacts() {
        assertThat(AuditActor.fromAgent("machine-1", List.of("AGENT"), "tenant-1"))
                .returns(AuditActorType.DEVICE, AuditActor::type)
                .returns("machine-1", AuditActor::id)
                .returns(List.of("AGENT"), AuditActor::roles)
                .returns("tenant-1", AuditActor::tokenTenantId);
    }

    @Test
    void fromApiKey_knownKey_actsAsTheKeyForItsOwner() {
        assertThat(AuditActor.fromApiKey("key-1", "Billing sync", List.of("ADMIN"), "tenant-1", "user-1"))
                .returns(AuditActorType.API_KEY, AuditActor::type)
                .returns("key-1", AuditActor::id)
                .returns("Billing sync", AuditActor::name)
                .returns(List.of("ADMIN"), AuditActor::roles)
                .returns("tenant-1", AuditActor::tokenTenantId)
                .returns("user-1", AuditActor::onBehalfOfId);
    }

    @Test
    void fromApiKey_unknownKey_hasNoRoles() {
        assertThat(AuditActor.fromApiKey("key-2", null, null, null, "user-1").roles()).isEmpty();
    }

    @Test
    void system_noCaller_isSystemWithoutIdentity() {
        assertThat(AuditActor.system())
                .returns(AuditActorType.SYSTEM, AuditActor::type)
                .returns(null, AuditActor::id)
                .returns(List.of(), AuditActor::roles);
    }

    @Test
    void tenantFor_requestedTenant_isTheRequestedTenant() {
        assertThat(TECHNICIAN.tenantFor("tenant-2", SUPER_TENANT_ID, () -> SERVED_TENANT_ID)).isEqualTo("tenant-2");
    }

    @Test
    void tenantFor_noRequestedTenant_isTheTokensTenant() {
        assertThat(TECHNICIAN.tenantFor(null, SUPER_TENANT_ID, () -> SERVED_TENANT_ID)).isEqualTo("tenant-1");
    }

    @Test
    void tenantFor_superTenantToken_isTheServedTenant() {
        AuditActor staff = AuditActor.fromUser("staff-1", null, List.of("ADMIN"), SUPER_TENANT_ID, SUPER_TENANT_ID);

        assertThat(staff.tenantFor(null, SUPER_TENANT_ID, () -> SERVED_TENANT_ID)).isEqualTo(SERVED_TENANT_ID);
    }

    @Test
    void tenantFor_noTokenTenant_isTheServedTenant() {
        AuditActor system = AuditActor.system();

        assertThat(system.tenantFor(null, SUPER_TENANT_ID, () -> SERVED_TENANT_ID)).isEqualTo(SERVED_TENANT_ID);
    }

    @Test
    void system_jobName_isTheSystemUnderTheJobsName() {
        assertThat(AuditActor.system("stale-ticket-sweep"))
                .returns(AuditActorType.SYSTEM, AuditActor::type)
                .returns("stale-ticket-sweep", AuditActor::id)
                .returns("stale-ticket-sweep", AuditActor::name);
    }

    @Test
    void system_scheduledRun_actsOnBehalfOfItsAuthor() {
        assertThat(AuditActor.system("scheduled-script-run", "user-1"))
                .returns(AuditActorType.SYSTEM, AuditActor::type)
                .returns("user-1", AuditActor::onBehalfOfId);
    }

    @Test
    void staff_flamingoPerson_isStaffWithTheirId() {
        assertThat(AuditActor.staff("hubspot-user-1"))
                .returns(AuditActorType.STAFF, AuditActor::type)
                .returns("hubspot-user-1", AuditActor::id);
    }

    @Test
    void mingo_toolCall_isMingoOnBehalfOfTheSender() {
        assertThat(AuditActor.mingo("user-1"))
                .returns(AuditActorType.MINGO, AuditActor::type)
                .returns("Mingo", AuditActor::name)
                .returns("user-1", AuditActor::onBehalfOfId);
    }

    @Test
    void fae_toolCall_isFaeOnBehalfOfTheDevice() {
        assertThat(AuditActor.fae("machine-1"))
                .returns(AuditActorType.FAE, AuditActor::type)
                .returns("Fae", AuditActor::name)
                .returns("machine-1", AuditActor::onBehalfOfId);
    }
}
