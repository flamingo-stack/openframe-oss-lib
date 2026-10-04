package com.openframe.authz.service.tenant;

import com.openframe.authz.dto.TenantRegistrationRequest;
import com.openframe.authz.service.processor.RegistrationProcessor;
import com.openframe.authz.service.user.UserService;
import com.openframe.core.email.EmailDomainPolicy;
import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.tenant.Tenant;
import com.openframe.data.document.tenant.TenantStatus;
import com.openframe.data.document.user.UserRole;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static com.openframe.authz.support.SsoTestFixtures.activeUser;
import static com.openframe.authz.support.SsoTestFixtures.tenant;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TenantRegistrationServiceTest {

    @Mock
    private UserService userService;
    @Mock
    private TenantService tenantService;
    @Mock
    private RegistrationProcessor registrationProcessor;
    @Mock
    private EmailDomainPolicy emailDomainPolicy;
    @InjectMocks
    private TenantRegistrationService service;

    private static TenantRegistrationRequest request(boolean preVerified) {
        return TenantRegistrationRequest.builder()
                .email("Owner@Acme.com").firstName("O").lastName("W").password("Str0ng-password!")
                .tenantName("Acme").tenantDomain("ACME").emailPreVerified(preVerified).build();
    }

    @Test
    void shouldCreateTenantWithOwnerAndLinkOwnerId() {
        Tenant created = tenant("reserved-id", TenantStatus.ACTIVE);
        AuthUser owner = activeUser("owner-1", "reserved-id", "owner@acme.com");
        when(tenantService.existByDomain("acme")).thenReturn(false);
        when(userService.existsActiveByEmail("owner@acme.com")).thenReturn(false);
        when(registrationProcessor.reserveTenantIdForRegistration(any())).thenReturn("reserved-id");
        when(tenantService.createTenant("reserved-id", "Acme", "acme")).thenReturn(created);
        when(userService.registerUser("reserved-id", "owner@acme.com", "O", "W", "Str0ng-password!", List.of(UserRole.OWNER)))
                .thenReturn(owner);
        when(tenantService.save(created)).thenReturn(created);

        Tenant saved = service.registerTenant(request(false));

        assertThat(saved.getOwnerId()).isEqualTo("owner-1");
        verify(registrationProcessor).preProcessTenantRegistration(any());
        verify(registrationProcessor).postProcessTenantRegistration(created, owner, request(false));
        verify(userService, never()).registerVerifiedUser(any(), any(), any(), any(), any(), any());
    }

    @Test
    void shouldCreateVerifiedOwnerForSsoRegistration() {
        Tenant created = tenant("t", TenantStatus.ACTIVE);
        when(registrationProcessor.reserveTenantIdForRegistration(any())).thenReturn("t");
        when(userService.existsActiveByEmail(anyString())).thenReturn(false);
        when(tenantService.createTenant(any(), any(), any())).thenReturn(created);
        when(userService.registerVerifiedUser(any(), any(), any(), any(), any(), any())).thenReturn(activeUser("o", "t", "owner@acme.com"));
        when(tenantService.save(created)).thenReturn(created);

        service.registerTenant(request(true));

        verify(userService, never()).registerUser(any(), any(), any(), any(), any(), any());
    }

    @Test
    void shouldRejectTakenDomain() {
        when(tenantService.existByDomain("acme")).thenReturn(true);

        assertThatThrownBy(() -> service.registerTenant(request(false))).hasMessageContaining("domain is already in use");
        verify(tenantService, never()).createTenant(any(), any(), any());
    }

    @Test
    void shouldRejectEmailActiveInAnyTenant() {
        when(userService.existsActiveByEmail("owner@acme.com")).thenReturn(true);

        assertThatThrownBy(() -> service.registerTenant(request(false))).hasMessageContaining("already belongs to another tenant");
        verify(tenantService, never()).createTenant(any(), any(), any());
    }

    @Test
    void shouldRejectBlockedEmailDomainBeforeWritingAnything() {
        doThrow(new IllegalArgumentException("blocked")).when(emailDomainPolicy).ensureEmailAllowed("owner@acme.com");

        assertThatThrownBy(() -> service.registerTenant(request(false))).hasMessage("blocked");
        verify(tenantService, never()).createTenant(any(), any(), any());
        verify(userService, never()).registerUser(any(), any(), any(), any(), any(), any());
    }

    @Test
    void shouldStopWhenPreProcessingRejects() {
        doThrow(new IllegalStateException("access code required")).when(registrationProcessor).preProcessTenantRegistration(any());

        assertThatThrownBy(() -> service.registerTenant(request(false))).hasMessage("access code required");
        verify(tenantService, never()).createTenant(any(), any(), any());
    }
}
