package com.openframe.authz.security;

import com.openframe.authz.config.oidc.MicrosoftSSOProperties;
import com.openframe.authz.config.tenant.TenantContext;
import com.openframe.authz.service.sso.SSOConfigService;
import com.openframe.authz.service.sso.SsoIdentityService;
import com.openframe.authz.service.user.UserService;
import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.tenant.SSOPerTenantConfig;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;

import java.util.Map;
import java.util.Optional;

import static com.openframe.authz.support.SsoTestFixtures.activeUser;
import static com.openframe.authz.support.SsoTestFixtures.authentication;
import static com.openframe.authz.support.SsoTestFixtures.oidcUser;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SsoIdentityCaptureTest {

    private static final String TENANT = "tenant-1";

    @Mock
    private SsoIdentityService ssoIdentityService;
    @Mock
    private UserService userService;
    @Mock
    private SSOConfigService ssoConfigService;

    private SsoIdentityCapture capture;
    private final AuthUser user = activeUser("user-1", TENANT, "ceo@acme.com");

    @BeforeEach
    void setUp() {
        capture = new SsoIdentityCapture(ssoIdentityService, userService, ssoConfigService,
                new EmailTrustPolicy(new MicrosoftSSOProperties()));
        TenantContext.setTenantId(TENANT);
        lenient().when(ssoConfigService.getSSOConfig(anyString(), anyString())).thenReturn(Optional.empty());
        lenient().when(userService.findActiveByEmailAndTenant("ceo@acme.com", TENANT)).thenReturn(Optional.of(user));
    }

    @AfterEach
    void clearTenant() {
        TenantContext.clear();
    }

    @Test
    void shouldLinkWhenTenantRunsItsOwnApp() {
        when(ssoConfigService.getSSOConfig(TENANT, "microsoft")).thenReturn(Optional.of(new SSOPerTenantConfig()));
        OidcUser untrustedClaims = oidcUser(Map.of("email", "CEO@acme.com", "tid", "t", "oid", "o"));

        capture.capture(authentication("microsoft", untrustedClaims));

        verify(ssoIdentityService).link("microsoft", untrustedClaims.getClaims(), user);
    }

    @Test
    void shouldLinkTrustedEmailFromGenericApp() {
        OidcUser trusted = oidcUser(Map.of("email", "ceo@acme.com", "email_verified", true));

        capture.capture(authentication("google", trusted));

        verify(ssoIdentityService).link("google", trusted.getClaims(), user);
    }

    @Test
    void shouldNotLinkUntrustedEmailFromGenericApp() {
        OidcUser untrusted = oidcUser(Map.of("email", "ceo@acme.com", "tid", "attacker-dir", "oid", "o"));

        capture.capture(authentication("microsoft", untrusted));

        verify(ssoIdentityService, never()).link(anyString(), any(), any());
    }

    @Test
    void shouldNotLinkWithoutTenantContext() {
        TenantContext.clear();

        capture.capture(authentication("google", oidcUser(Map.of("email", "ceo@acme.com"))));

        verify(ssoIdentityService, never()).link(anyString(), any(), any());
    }

    @Test
    void shouldNotLinkWithoutEmailOrActiveUser() {
        capture.capture(authentication("google", oidcUser(Map.of())));
        capture.capture(authentication("google", oidcUser(Map.of("email", "nobody@acme.com"))));

        verify(ssoIdentityService, never()).link(anyString(), any(), any());
    }

    @Test
    void shouldSwallowFailures() {
        when(userService.findActiveByEmailAndTenant(anyString(), anyString())).thenThrow(new IllegalStateException("db"));

        assertThatCode(() -> capture.capture(authentication("google", oidcUser(Map.of("email", "ceo@acme.com")))))
                .doesNotThrowAnyException();
    }
}
