package com.openframe.authz.security;

import com.openframe.authz.config.oidc.MicrosoftSSOProperties;
import com.openframe.authz.config.tenant.TenantContext;
import com.openframe.authz.service.sso.SSOConfigService;
import com.openframe.authz.service.sso.SsoIdentityService;
import com.openframe.authz.service.user.UserService;
import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.auth.SsoIdentity;
import com.openframe.data.document.tenant.SSOPerTenantConfig;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;

import java.util.Map;
import java.util.Optional;

import static com.openframe.authz.support.SsoTestFixtures.activeUser;
import static com.openframe.authz.support.SsoTestFixtures.authentication;
import static com.openframe.authz.support.SsoTestFixtures.oidcUser;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MicrosoftLoginEmailGateTest {

    private static final String TENANT = "tenant-1";

    @Mock
    private SSOConfigService ssoConfigService;
    @Mock
    private SsoIdentityService ssoIdentityService;
    @Mock
    private UserService userService;

    private final MicrosoftSSOProperties props = new MicrosoftSSOProperties();
    private MicrosoftLoginEmailGate gate;

    private final OidcUser untrusted = oidcUser(Map.of("email", "ceo@victim.com", "tid", "attacker-dir", "oid", "o-1"));

    @BeforeEach
    void setUp() {
        props.setRequireVerifiedEmail(true);
        gate = new MicrosoftLoginEmailGate(props, ssoConfigService, new EmailTrustPolicy(props), ssoIdentityService, userService);
        TenantContext.setTenantId(TENANT);
        lenient().when(ssoConfigService.getSSOConfig(TENANT, "microsoft")).thenReturn(Optional.empty());
        lenient().when(ssoIdentityService.findLink(eq("microsoft"), anyMap())).thenReturn(Optional.empty());
    }

    @AfterEach
    void clearTenant() {
        TenantContext.clear();
    }

    @Test
    void shouldDoNothingWhenFlagIsOff() {
        props.setRequireVerifiedEmail(false);

        assertThatCode(() -> gate.require(authentication("microsoft", untrusted))).doesNotThrowAnyException();
        verifyNoInteractions(ssoConfigService, ssoIdentityService);
    }

    @Test
    void shouldIgnoreOtherProvidersAndNonOidcAuthentications() {
        assertThatCode(() -> gate.require(authentication("google", untrusted))).doesNotThrowAnyException();
        assertThatCode(() -> gate.require(new UsernamePasswordAuthenticationToken("u", "p"))).doesNotThrowAnyException();
    }

    @Test
    void shouldPassTenantThatRunsItsOwnMicrosoftApp() {
        when(ssoConfigService.getSSOConfig(TENANT, "microsoft")).thenReturn(Optional.of(new SSOPerTenantConfig()));

        assertThatCode(() -> gate.require(authentication("microsoft", untrusted))).doesNotThrowAnyException();
    }

    @Test
    void shouldPassWhenLinkPointsToActiveUserWithSameEmailInThisTenant() {
        linkTo(activeUser("user-1", TENANT, "CEO@victim.com"));

        assertThatCode(() -> gate.require(authentication("microsoft", untrusted))).doesNotThrowAnyException();
    }

    @Test
    void shouldRejectWhenLinkPointsToAnotherTenant() {
        linkTo(activeUser("user-1", "other-tenant", "ceo@victim.com"));

        assertThatThrownBy(() -> gate.require(authentication("microsoft", untrusted)))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void shouldRejectWhenLinkPointsToUserWithAnotherEmail() {
        linkTo(activeUser("user-1", TENANT, "someone@victim.com"));

        assertThatThrownBy(() -> gate.require(authentication("microsoft", untrusted)))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void shouldRejectWhenLinkedUserIsNoLongerActive() {
        when(ssoIdentityService.findLink(eq("microsoft"), anyMap()))
                .thenReturn(Optional.of(SsoIdentity.builder().userId("user-1").build()));
        when(userService.findActiveById("user-1")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> gate.require(authentication("microsoft", untrusted)))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void shouldRejectUntrustedEmailWithoutLink() {
        assertThatThrownBy(() -> gate.require(authentication("microsoft", untrusted)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("not verified");
    }

    @Test
    void shouldPassTrustedEmailWithoutLink() {
        OidcUser trusted = oidcUser(Map.of("email", "ceo@acme.com", "tid", "org", "oid", "o-1", "xms_edov", true));

        assertThatCode(() -> gate.require(authentication("microsoft", trusted))).doesNotThrowAnyException();
    }

    private void linkTo(AuthUser user) {
        when(ssoIdentityService.findLink(eq("microsoft"), any()))
                .thenReturn(Optional.of(SsoIdentity.builder().userId(user.getId()).build()));
        when(userService.findActiveById(user.getId())).thenReturn(Optional.of(user));
    }
}
