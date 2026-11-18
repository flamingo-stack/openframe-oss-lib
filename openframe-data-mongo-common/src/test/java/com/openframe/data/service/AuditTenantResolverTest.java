package com.openframe.data.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuditTenantResolverTest {

    private static final String SUPER_TENANT_ID = "super-tenant";
    private static final String SERVED_TENANT_ID = "tenant-1";

    @Mock
    private TenantIdProvider tenantIdProvider;

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
    void belongsToAnotherTenant_recordOfTheEventsTenant_isFalse() {
        assertThat(sharedService().belongsToAnotherTenant("tenant-1", "tenant-1")).isFalse();
    }

    @Test
    void belongsToAnotherTenant_recordOfAnotherTenantThanTheEvents_isTrue() {
        assertThat(sharedService().belongsToAnotherTenant("tenant-2", "tenant-1")).isTrue();
    }

    @Test
    void belongsToAnotherTenant_recordThatBelongsToNoTenant_isFalse() {
        assertThat(sharedService().belongsToAnotherTenant(null, "tenant-1")).isFalse();
    }

    @Test
    void belongsToAnotherTenant_eventOfThePlatformTenant_isFalse() {
        assertThat(sharedService().belongsToAnotherTenant("tenant-2", SUPER_TENANT_ID)).isFalse();
    }

    @Test
    void belongsToAnotherTenant_serviceOfOneTenant_isFalseWhateverTheTenants() {
        assertThat(tenantService().belongsToAnotherTenant("tenant-2", "tenant-1")).isFalse();
    }

    private AuditTenantResolver tenantService() {
        return new AuditTenantResolver(tenantIdProvider, SUPER_TENANT_ID, true);
    }

    private AuditTenantResolver sharedService() {
        return new AuditTenantResolver(tenantIdProvider, SUPER_TENANT_ID, false);
    }
}
