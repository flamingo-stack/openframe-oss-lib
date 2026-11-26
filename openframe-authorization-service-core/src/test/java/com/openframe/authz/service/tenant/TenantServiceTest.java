package com.openframe.authz.service.tenant;

import com.openframe.authz.service.validation.RegistrationValidationService;
import com.openframe.core.exception.AuthFlowException;
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

import static com.openframe.core.exception.AuthErrorCode.ACCOUNT_BLOCKED;
import static com.openframe.core.exception.AuthErrorCode.ACCOUNT_INACTIVE;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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
    void refuseLoginUnlessActive_activeTenant_passes() {
        when(tenantRepository.findById(TENANT_ID)).thenReturn(Optional.of(tenant(TenantStatus.ACTIVE)));

        assertThatCode(() -> service.refuseLoginUnlessActive(TENANT_ID)).doesNotThrowAnyException();
    }

    @Test
    void refuseLoginUnlessActive_tenantWithoutStatus_passesAsTheDocumentDefault() {
        when(tenantRepository.findById(TENANT_ID)).thenReturn(Optional.of(tenant(null)));

        assertThatCode(() -> service.refuseLoginUnlessActive(TENANT_ID)).doesNotThrowAnyException();
    }

    @Test
    void refuseLoginUnlessActive_blockedTenant_saysItIsBlocked() {
        when(tenantRepository.findById(TENANT_ID)).thenReturn(Optional.of(tenant(TenantStatus.BLOCKED)));

        assertThatThrownBy(() -> service.refuseLoginUnlessActive(TENANT_ID))
                .isInstanceOf(AuthFlowException.class)
                .hasMessage(ACCOUNT_BLOCKED.getMessage())
                .extracting(e -> ((AuthFlowException) e).getCode())
                .isEqualTo(ACCOUNT_BLOCKED);
    }

    @Test
    void refuseLoginUnlessActive_deletedTenant_isInactive() {
        when(tenantRepository.findById(TENANT_ID)).thenReturn(Optional.of(tenant(TenantStatus.DELETED)));

        assertThatThrownBy(() -> service.refuseLoginUnlessActive(TENANT_ID))
                .isInstanceOf(AuthFlowException.class)
                .extracting(e -> ((AuthFlowException) e).getCode())
                .isEqualTo(ACCOUNT_INACTIVE);
    }

    @Test
    void refuseLoginUnlessActive_unknownTenant_isInactive() {
        when(tenantRepository.findById(TENANT_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.refuseLoginUnlessActive(TENANT_ID))
                .isInstanceOf(AuthFlowException.class)
                .extracting(e -> ((AuthFlowException) e).getCode())
                .isEqualTo(ACCOUNT_INACTIVE);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void refuseLoginUnlessActive_blankTenantId_isInactiveWithoutLookup(String tenantId) {
        assertThatThrownBy(() -> service.refuseLoginUnlessActive(tenantId)).isInstanceOf(AuthFlowException.class);
        verify(tenantRepository, never()).findById(anyString());
    }

    private static Tenant tenant(TenantStatus status) {
        return Tenant.builder().id(TENANT_ID).status(status).build();
    }
}
