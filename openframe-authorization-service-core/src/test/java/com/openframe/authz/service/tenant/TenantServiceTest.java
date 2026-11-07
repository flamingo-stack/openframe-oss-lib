package com.openframe.authz.service.tenant;

import com.openframe.authz.service.validation.RegistrationValidationService;
import com.openframe.data.document.tenant.Tenant;
import com.openframe.data.document.tenant.TenantStatus;
import com.openframe.data.repository.tenant.TenantRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TenantServiceTest {

    private static final String TENANT_ID = "tenant-1";

    @Mock private TenantRepository tenantRepository;
    @Mock private RegistrationValidationService registrationValidationService;

    @InjectMocks private TenantService service;

    @Test
    void isActive_activeTenant_true() {
        // setup
        Tenant tenant = tenant(TenantStatus.ACTIVE);
        when(tenantRepository.findById(TENANT_ID)).thenReturn(Optional.of(tenant));

        // execution
        boolean active = service.isActive(TENANT_ID);

        // verifications
        assertThat(active).isTrue();
    }

    @Test
    void isActive_inactiveTenant_false() {
        // setup
        Tenant tenant = tenant(TenantStatus.INACTIVE);
        when(tenantRepository.findById(TENANT_ID)).thenReturn(Optional.of(tenant));

        // execution
        boolean active = service.isActive(TENANT_ID);

        // verifications
        assertThat(active).isFalse();
    }

    @Test
    void isActive_unknownTenant_false() {
        // setup
        when(tenantRepository.findById(TENANT_ID)).thenReturn(Optional.empty());

        // execution
        boolean active = service.isActive(TENANT_ID);

        // verifications
        assertThat(active).isFalse();
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void isActive_blankTenantId_falseWithoutLookup(String tenantId) {
        // setup

        // execution
        boolean active = service.isActive(tenantId);

        // verifications
        assertThat(active).isFalse();
        verify(tenantRepository, never()).findById(anyString());
    }

    private static Tenant tenant(TenantStatus status) {
        return Tenant.builder().id(TENANT_ID).status(status).build();
    }
}
