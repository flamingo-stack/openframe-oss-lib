package com.openframe.authz.service.validation;

import com.openframe.authz.service.sso.SSOConfigService;
import com.openframe.data.document.auth.AuthInvitation;
import com.openframe.data.document.user.InvitationStatus;
import com.openframe.data.repository.auth.AuthInvitationRepository;
import com.openframe.data.repository.tenant.TenantRepository;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static com.openframe.authz.security.SsoRegistrationConstants.ONBOARDING_TENANT_ID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ValidatorsTest {

    private final AuthInvitationRepository invitationRepository = mock(AuthInvitationRepository.class);
    private final InvitationValidator invitationValidator = new InvitationValidator(invitationRepository);

    private static AuthInvitation invitation(InvitationStatus status, Instant expiresAt) {
        return AuthInvitation.builder().id("inv-1").status(status).expiresAt(expiresAt).build();
    }

    @Test
    void shouldAcceptPendingUnexpiredInvitation() {
        when(invitationRepository.findById("inv-1")).thenReturn(Optional.of(invitation(InvitationStatus.PENDING, null)));

        assertThat(invitationValidator.loadAndEnsureAcceptable("inv-1").getId()).isEqualTo("inv-1");
    }

    @Test
    void shouldRejectUnknownUsedRevokedOrExpiredInvitation() {
        when(invitationRepository.findById("missing")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> invitationValidator.loadAndEnsureAcceptable("missing"))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("Invitation not found");
        assertThatThrownBy(() -> invitationValidator.ensureAcceptable(invitation(InvitationStatus.ACCEPTED, null)))
                .hasMessage("Invitation already used or revoked");
        assertThatThrownBy(() -> invitationValidator.ensureAcceptable(invitation(InvitationStatus.REVOKED, null)))
                .hasMessage("Invitation already used or revoked");
        assertThatThrownBy(() -> invitationValidator.ensureAcceptable(
                invitation(InvitationStatus.PENDING, Instant.now().minusSeconds(1))))
                .hasMessage("Invitation expired");
    }

    @Test
    void shouldNormalizeProviderAndRequireItConfiguredForTheTenant() {
        SSOConfigService ssoConfigService = mock(SSOConfigService.class);
        SsoProviderValidator validator = new SsoProviderValidator(ssoConfigService);
        when(ssoConfigService.getEffectiveProvidersForTenant("tenant-1")).thenReturn(List.of("google"));
        when(ssoConfigService.getEffectiveProvidersForTenant(ONBOARDING_TENANT_ID)).thenReturn(List.of("microsoft"));

        assertThat(validator.normalizeProvider("  Google ")).isEqualTo("google");
        assertThatCode(() -> validator.ensureProviderConfiguredForTenant("tenant-1", "google")).doesNotThrowAnyException();
        assertThatThrownBy(() -> validator.ensureProviderConfiguredForTenant("tenant-1", "microsoft"))
                .hasMessage("SSO provider not configured");
        assertThatCode(() -> validator.ensureProviderConfiguredForOnboarding("microsoft")).doesNotThrowAnyException();
        assertThatThrownBy(() -> validator.ensureProviderConfiguredForOnboarding("google"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void shouldCheckTenantDomainCaseInsensitively() {
        TenantRepository tenantRepository = mock(TenantRepository.class);
        when(tenantRepository.existsByDomain("acme")).thenReturn(true);

        assertThatThrownBy(() -> new RegistrationValidationService(tenantRepository).ensureTenantDomainAvailable("ACME"))
                .hasMessage("Tenant domain already exists");
    }
}
