package com.openframe.authz.security.flow;

import com.openframe.authz.config.oidc.MicrosoftSSOProperties;
import com.openframe.authz.security.EmailTrustPolicy;
import com.openframe.authz.security.SsoCookieCodec;
import com.openframe.authz.security.SsoLoginCookiePayload;
import com.openframe.authz.service.sso.SSOConfigService;
import com.openframe.authz.service.sso.SignupTicketService;
import com.openframe.authz.service.sso.SsoIdentityService;
import com.openframe.authz.service.sso.SsoOidcUserService;
import com.openframe.authz.service.tenant.TenantService;
import com.openframe.authz.service.user.UserService;
import com.openframe.core.constants.SsoFlowCookieNames;
import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.auth.SsoIdentity;
import com.openframe.data.document.tenant.SSOPerTenantConfig;
import com.openframe.data.document.tenant.TenantStatus;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Map;
import java.util.Optional;

import static com.openframe.authz.support.ServletTestSupport.bind;
import static com.openframe.authz.support.ServletTestSupport.unbind;
import static com.openframe.authz.support.SsoTestFixtures.activeUser;
import static com.openframe.authz.support.SsoTestFixtures.authentication;
import static com.openframe.authz.support.SsoTestFixtures.cookieCodec;
import static com.openframe.authz.support.SsoTestFixtures.inTenMinutes;
import static com.openframe.authz.support.SsoTestFixtures.oidcUser;
import static com.openframe.authz.support.SsoTestFixtures.tenant;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LoginSsoHandlerTest {

    private static final String TENANT = "tenant-1";

    @Mock
    private SignupTicketService signupTicketService;
    @Mock
    private SsoIdentityService ssoIdentityService;
    @Mock
    private SsoOidcUserService ssoOidcUserService;
    @Mock
    private UserService userService;
    @Mock
    private TenantService tenantService;
    @Mock
    private SSOConfigService ssoConfigService;

    private final SsoCookieCodec codec = cookieCodec();
    private LoginSsoHandler handler;
    private final MockHttpServletResponse response = new MockHttpServletResponse();
    private final AuthUser existing = activeUser("user-1", TENANT, "ada@acme.com");

    private final OidcUser trustedGoogle = oidcUser(Map.of("email", "Ada@acme.com", "email_verified", true, "sub", "g-1"));
    private final OidcUser untrustedMicrosoft = oidcUser(Map.of("email", "ada@acme.com", "tid", "attacker", "oid", "o-1"));

    @BeforeEach
    void setUp() {
        handler = new LoginSsoHandler(codec, signupTicketService, ssoIdentityService, ssoOidcUserService,
                new EmailTrustPolicy(new MicrosoftSSOProperties()), userService, tenantService, ssoConfigService);
        lenient().when(ssoIdentityService.findLink(anyString(), anyMap())).thenReturn(Optional.empty());
        lenient().when(ssoConfigService.getSSOConfig(anyString(), anyString())).thenReturn(Optional.empty());
        lenient().when(tenantService.findById(TENANT)).thenReturn(Optional.of(tenant(TENANT, TenantStatus.ACTIVE)));
    }

    @AfterEach
    void tearDown() {
        unbind();
    }

    private MockHttpServletRequest request(String redirectTo, boolean authMobile) {
        MockHttpServletRequest request = bind(new MockHttpServletRequest("GET", "/login/oauth2/code/google"));
        request.setCookies(new Cookie(SsoFlowCookieNames.OF_SSO_LOGIN, codec.encodeLogin(
                new SsoLoginCookiePayload("login-state", "google", redirectTo, authMobile, 1L, inTenMinutes()))));
        return request;
    }

    private MockHttpServletRequest request() {
        return request(null, false);
    }

    @Test
    void shouldLogInLinkedUserEvenWhenEmailClaimIsUntrusted() throws Exception {
        when(ssoIdentityService.findLink(eq("microsoft"), anyMap()))
                .thenReturn(Optional.of(SsoIdentity.builder().userId("user-1").build()));
        when(userService.findActiveById("user-1")).thenReturn(Optional.of(existing));

        handler.handle(request(), response, authentication("microsoft", untrustedMicrosoft));

        verify(ssoIdentityService).link("microsoft", untrustedMicrosoft.getClaims(), existing);
        assertThat(response.getHeader("Location")).isEqualTo("https://auth.example.com/oauth/continue?tenantId=tenant-1");
    }

    @Test
    void shouldRequireTrustedEmailWhenLinkedUserIsInactive() {
        when(ssoIdentityService.findLink(eq("microsoft"), anyMap()))
                .thenReturn(Optional.of(SsoIdentity.builder().userId("user-1").build()));
        when(userService.findActiveById("user-1")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> handler.handle(request(), response, authentication("microsoft", untrustedMicrosoft)))
                .hasMessageContaining("not verified by the provider");
        verify(ssoIdentityService, never()).link(anyString(), any(), any());
    }

    @Test
    void shouldRejectUntrustedEmailWithoutLink() {
        assertThatThrownBy(() -> handler.handle(request(), response, authentication("microsoft", untrustedMicrosoft)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("not verified by the provider");
        verify(userService, never()).findActiveByEmail(anyString());
        verify(ssoIdentityService, never()).link(anyString(), any(), any());
    }

    @Test
    void shouldRouteTrustedEmailToExistingUserAndLink() throws Exception {
        when(userService.findActiveByEmail("ada@acme.com")).thenReturn(Optional.of(existing));

        handler.handle(request("/devices", false), response, authentication("google", trustedGoogle));

        verify(ssoIdentityService).link("google", trustedGoogle.getClaims(), existing);
        assertThat(response.getHeader("Location"))
                .isEqualTo("https://auth.example.com/oauth/continue?tenantId=tenant-1&redirectTo=%2Fdevices");
        assertThat(response.getCookies()).anySatisfy(c -> {
            assertThat(c.getName()).isEqualTo(SsoFlowCookieNames.OF_SSO_LOGIN);
            assertThat(c.getMaxAge()).isZero();
        });
    }

    @Test
    void shouldRejectGenericAppForTenantWithItsOwnProviderApp() {
        when(userService.findActiveByEmail("ada@acme.com")).thenReturn(Optional.of(existing));
        when(ssoConfigService.getSSOConfig(TENANT, "google")).thenReturn(Optional.of(new SSOPerTenantConfig()));

        assertThatThrownBy(() -> handler.handle(request(), response, authentication("google", trustedGoogle)))
                .hasMessageContaining("uses its own sign-in");
        verify(ssoIdentityService, never()).link(anyString(), any(), any());
    }

    @Test
    void shouldRejectInactiveTenantWithoutLinking() {
        when(userService.findActiveByEmail("ada@acme.com")).thenReturn(Optional.of(existing));
        when(tenantService.findById(TENANT)).thenReturn(Optional.of(tenant(TENANT, TenantStatus.INACTIVE)));

        assertThatThrownBy(() -> handler.handle(request(), response, authentication("google", trustedGoogle)))
                .hasMessageContaining("not active");
        verify(ssoIdentityService, never()).link(anyString(), any(), any());
    }

    @Test
    void shouldSendUnknownSharedDomainUserToConsentPageWithoutProvisioning() throws Exception {
        ReflectionTestUtils.setField(handler, "joinConfirmUrl", "/auth/sso-join");
        ReflectionTestUtils.setField(handler, "loginJoinConfirmEnabled", true);
        when(userService.findActiveByEmail("ada@acme.com")).thenReturn(Optional.empty());
        when(ssoOidcUserService.autoProvisionTenantForDomain("ada@acme.com")).thenReturn(Optional.of(TENANT));

        handler.handle(request(), response, authentication("google", trustedGoogle));

        assertThat(response.getRedirectedUrl()).isEqualTo("/auth/sso-join");
        verify(ssoOidcUserService, never()).autoProvisionByGlobalDomain(anyString(), any());
        verify(ssoIdentityService, never()).link(anyString(), any(), any());
    }

    @Test
    void shouldProvisionSharedDomainUserImmediatelyWhenConsentGateIsOff() throws Exception {
        ReflectionTestUtils.setField(handler, "joinConfirmUrl", "/auth/sso-join");
        when(userService.findActiveByEmail("ada@acme.com")).thenReturn(Optional.empty());
        when(ssoOidcUserService.autoProvisionTenantForDomain("ada@acme.com")).thenReturn(Optional.of(TENANT));
        when(ssoOidcUserService.autoProvisionByGlobalDomain("google", trustedGoogle)).thenReturn(Optional.of(existing));

        handler.handle(request(), response, authentication("google", trustedGoogle));

        verify(ssoIdentityService).link("google", trustedGoogle.getClaims(), existing);
        assertThat(response.getHeader("Location")).contains("tenantId=tenant-1");
    }

    @Test
    void shouldContinueUnknownWebUserIntoRegistration() throws Exception {
        ReflectionTestUtils.setField(handler, "signupContinueUrl", "/auth/sso-continue");
        when(userService.findActiveByEmail("ada@acme.com")).thenReturn(Optional.empty());
        when(ssoOidcUserService.autoProvisionTenantForDomain("ada@acme.com")).thenReturn(Optional.empty());

        handler.handle(request(), response, authentication("google", trustedGoogle));

        assertThat(response.getRedirectedUrl()).isEqualTo("/auth/sso-continue");
        verify(signupTicketService, never()).create(any(), any(), any(), any(), anyBoolean(), any());
    }

    @Test
    void shouldRejectUnknownUserWhenRegistrationContinuationIsOff() {
        when(userService.findActiveByEmail("ada@acme.com")).thenReturn(Optional.empty());
        when(ssoOidcUserService.autoProvisionTenantForDomain("ada@acme.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> handler.handle(request(), response, authentication("google", trustedGoogle)))
                .hasMessageContaining("No account found for ada@acme.com");
    }

    @Test
    void shouldParkUnknownMobileIdentityBehindSignupTicketAndBffHop() throws Exception {
        when(userService.findActiveByEmail("ada@acme.com")).thenReturn(Optional.empty());
        when(ssoOidcUserService.autoProvisionTenantForDomain("ada@acme.com")).thenReturn(Optional.empty());
        when(ssoIdentityService.subjectOf(eq("google"), anyMap())).thenReturn(Optional.of("g-1"));
        when(signupTicketService.create("ada@acme.com", "Ada", "", "google", true, "g-1")).thenReturn("ticket/1");

        handler.handle(request("com.openframe.app://auth", true), response, authentication("google", trustedGoogle));

        assertThat(response.getHeader("Location")).isEqualTo(
                "https://auth.example.com/oauth/signup-continue?signupTicket=ticket%2F1&redirectTo=com.openframe.app%3A%2F%2Fauth");
    }

    @Test
    void shouldExposeStateOfItsOwnCookie() {
        assertThat(handler.expectedState(new Cookie(SsoFlowCookieNames.OF_SSO_LOGIN, codec.encodeLogin(
                new SsoLoginCookiePayload("login-state", "google", null, false, 1L, inTenMinutes())))))
                .contains("login-state");
    }
}
