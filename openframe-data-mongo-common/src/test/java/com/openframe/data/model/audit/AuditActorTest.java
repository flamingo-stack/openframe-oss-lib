package com.openframe.data.model.audit;

import com.openframe.data.document.audit.AuditActorType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

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
    void identity_actorWithAnId_isItsTypeAndId() {
        assertThat(AuditActor.staff("staff-1").identity()).isEqualTo("STAFF:staff-1");
    }

    @Test
    void identity_aiActingForAUser_namesThatUser() {
        assertThat(AuditActor.mingo("user-1").identity()).isEqualTo("MINGO:user-1");
    }

    @Test
    void identity_apiKeyWithAnOwner_namesTheKeyAndItsOwner() {
        assertThat(AuditActor.fromApiKey("key-1", "CI key", List.of("ADMIN"), null, "user-7").identity())
                .isEqualTo("API_KEY:key-1:user-7");
    }

    @Test
    void tenantFor_requestedTenant_isTheRequestedTenant() {
        assertThat(TECHNICIAN.tenantFor("tenant-2", SUPER_TENANT_ID, () -> SERVED_TENANT_ID)).isEqualTo("tenant-2");
    }

    @Test
    void tenantFor_noRequestedTenant_isTheTokensTenant() {
        assertThat(TECHNICIAN.tenantFor(null, SUPER_TENANT_ID, () -> SERVED_TENANT_ID)).isEqualTo("tenant-1");
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " "})
    void tenantFor_blankRequestedTenant_isTheTokensTenant(String requestedTenantId) {
        assertThat(TECHNICIAN.tenantFor(requestedTenantId, SUPER_TENANT_ID, () -> SERVED_TENANT_ID))
                .isEqualTo("tenant-1");
    }

    @Test
    void tenantFor_blankTokenTenant_isTheServedTenant() {
        AuditActor agent = AuditActor.fromAgent("machine-1", List.of("AGENT"), " ");

        assertThat(agent.tenantFor(null, SUPER_TENANT_ID, () -> SERVED_TENANT_ID)).isEqualTo(SERVED_TENANT_ID);
    }

    @Test
    void tenantFor_superTenantToken_isTheServedTenant() {
        AuditActor staff = AuditActor.fromUser("staff-1", null, List.of("ADMIN"), SUPER_TENANT_ID, SUPER_TENANT_ID);

        assertThat(staff.tenantFor(null, SUPER_TENANT_ID, () -> SERVED_TENANT_ID)).isEqualTo(SERVED_TENANT_ID);
    }
}
