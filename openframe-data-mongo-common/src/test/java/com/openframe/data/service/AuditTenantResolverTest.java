package com.openframe.data.service;

import com.openframe.data.model.audit.AuditActor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuditTenantResolverTest {

    private static final String SUPER_TENANT_ID = "super-tenant";
    private static final String SERVED_TENANT_ID = "tenant-1";

    @Mock
    private TenantIdProvider tenantIdProvider;

    @Test
    void superTenantId_configured_returnsConfiguredId() {
        assertThat(sharedService().superTenantId()).isEqualTo(SUPER_TENANT_ID);
    }

    @Test
    void servedTenantId_tenantIsolatedService_returnsProviderTenant() {
        when(tenantIdProvider.getTenantId()).thenReturn(SERVED_TENANT_ID);

        assertThat(tenantService().servedTenantId()).isEqualTo(SERVED_TENANT_ID);
    }

    @Test
    void servedTenantId_sharedServiceWithSuperTenant_returnsSuperTenant() {
        assertThat(sharedService().servedTenantId()).isEqualTo(SUPER_TENANT_ID);
    }

    @Test
    void servedTenantId_sharedServiceWithoutSuperTenant_returnsProviderTenant() {
        when(tenantIdProvider.getTenantId()).thenReturn("oss");

        assertThat(new AuditTenantResolver(tenantIdProvider, "", false).servedTenantId()).isEqualTo("oss");
    }

    @Test
    void isolatedTenantId_tenantIsolatedService_returnsProviderTenant() {
        when(tenantIdProvider.getTenantId()).thenReturn(SERVED_TENANT_ID);

        assertThat(tenantService().isolatedTenantId()).isEqualTo(SERVED_TENANT_ID);
    }

    @Test
    void isolatedTenantId_sharedService_returnsNull() {
        assertThat(sharedService().isolatedTenantId()).isNull();
    }

    @Test
    void tenantFor_requestedTenant_returnsRequestedTenant() {
        AuditActor user = AuditActor.fromUser("user-1", "anna@acme.com", List.of("ADMIN"), SERVED_TENANT_ID,
                SUPER_TENANT_ID);

        assertThat(tenantService().tenantFor(user, "tenant-2")).isEqualTo("tenant-2");
    }

    @Test
    void tenantFor_staffTokenInTenantIsolatedService_returnsServedTenant() {
        when(tenantIdProvider.getTenantId()).thenReturn(SERVED_TENANT_ID);
        AuditActor staff = AuditActor.fromUser("staff-1", "staff@flamingo.cx", List.of("ADMIN"), SUPER_TENANT_ID,
                SUPER_TENANT_ID);

        assertThat(tenantService().tenantFor(staff, null)).isEqualTo(SERVED_TENANT_ID);
    }

    @Test
    void tenantFor_noTenantInSharedService_returnsSuperTenant() {
        assertThat(sharedService().tenantFor(AuditActor.system(), null)).isEqualTo(SUPER_TENANT_ID);
    }

    private AuditTenantResolver tenantService() {
        return new AuditTenantResolver(tenantIdProvider, SUPER_TENANT_ID, true);
    }

    private AuditTenantResolver sharedService() {
        return new AuditTenantResolver(tenantIdProvider, SUPER_TENANT_ID, false);
    }
}
