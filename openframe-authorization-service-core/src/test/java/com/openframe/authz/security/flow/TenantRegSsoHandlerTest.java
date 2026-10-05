package com.openframe.authz.security.flow;

import com.openframe.authz.dto.RegistrationAttribution;
import com.openframe.authz.dto.TenantRegistrationRequest;
import com.openframe.authz.security.SsoCookieCodec;
import com.openframe.authz.security.SsoTenantRegCookiePayload;
import com.openframe.authz.service.sso.SsoAlreadyLinkedException;
import com.openframe.authz.service.sso.SsoIdentityService;
import com.openframe.authz.service.tenant.TenantRegistrationService;
import com.openframe.core.constants.SsoFlowCookieNames;
import com.openframe.data.document.tenant.Tenant;
import com.openframe.data.document.tenant.TenantStatus;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;

import java.util.Map;

import static com.openframe.authz.support.ServletTestSupport.bind;
import static com.openframe.authz.support.ServletTestSupport.unbind;
import static com.openframe.authz.support.SsoTestFixtures.authentication;
import static com.openframe.authz.support.SsoTestFixtures.cookieCodec;
import static com.openframe.authz.support.SsoTestFixtures.inTenMinutes;
import static com.openframe.authz.support.SsoTestFixtures.oidcUser;
import static com.openframe.authz.support.SsoTestFixtures.tenant;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TenantRegSsoHandlerTest {

    @Mock
    private TenantRegistrationService registrationService;
    @Mock
    private SsoIdentityService ssoIdentityService;

    private final SsoCookieCodec codec = cookieCodec();
    private TenantRegSsoHandler handler;
    private final MockHttpServletResponse response = new MockHttpServletResponse();

    private final OidcUser owner = oidcUser(Map.of(
            "email", "Owner@Acme.com", "email_verified", true,
            "given_name", "Ada", "family_name", "Owner", "picture", "https://img/a.png"));

    @BeforeEach
    void setUp() {
        handler = new TenantRegSsoHandler(codec, registrationService, ssoIdentityService);
    }

    @AfterEach
    void tearDown() {
        unbind();
    }

    private MockHttpServletRequest requestWith(SsoTenantRegCookiePayload payload) {
        MockHttpServletRequest request = bind(new MockHttpServletRequest("GET", "/login/oauth2/code/google"));
        request.setCookies(new Cookie(SsoFlowCookieNames.OF_SSO_REG, codec.encodeTenant(payload)));
        return request;
    }

    private static SsoTenantRegCookiePayload payload(String formEmail, String name, String domain) {
        return new SsoTenantRegCookiePayload("reg-state", formEmail, name, domain, "google",
                "/welcome", false, RegistrationAttribution.builder().utmSource("ads").build(), 1L, inTenMinutes());
    }

    @Test
    void shouldExposeStateOfItsOwnCookieOnly() {
        String token = codec.encodeTenant(payload("owner@acme.com", "Acme", "acme"));

        assertThat(handler.expectedState(new Cookie(SsoFlowCookieNames.OF_SSO_REG, token))).contains("reg-state");
        assertThat(handler.expectedState(new Cookie(SsoFlowCookieNames.OF_SSO_REG, "tampered"))).isEmpty();
    }

    @Test
    void shouldRegisterTenantWithSsoIdentityAndContinueIntoIt() {
        when(registrationService.registerTenant(any())).thenReturn(tenant("new-tenant", TenantStatus.ACTIVE));

        handler.handle(requestWith(payload("owner@acme.com", "Acme", "ACME")), response, authentication("google", owner));

        ArgumentCaptor<TenantRegistrationRequest> reg = ArgumentCaptor.forClass(TenantRegistrationRequest.class);
        verify(registrationService).registerTenant(reg.capture());
        assertThat(reg.getValue().getEmail()).isEqualTo("owner@acme.com");
        assertThat(reg.getValue().getFirstName()).isEqualTo("Ada");
        assertThat(reg.getValue().getLastName()).isEqualTo("Owner");
        assertThat(reg.getValue().getPictureUrl()).isEqualTo("https://img/a.png");
        assertThat(reg.getValue().getTenantName()).isEqualTo("Acme");
        assertThat(reg.getValue().getTenantDomain()).isEqualTo("acme");
        assertThat(reg.getValue().isEmailPreVerified()).isTrue();
        assertThat(reg.getValue().getAttribution().getUtmSource()).isEqualTo("ads");
        assertThat(reg.getValue().getPassword()).isNotBlank();
        assertThat(response.getHeader("Location"))
                .isEqualTo("https://auth.example.com/oauth/continue?tenantId=new-tenant&redirectTo=%2Fwelcome");
        assertThat(response.getCookies()).anySatisfy(c -> {
            assertThat(c.getName()).isEqualTo(SsoFlowCookieNames.OF_SSO_REG);
            assertThat(c.getMaxAge()).isZero();
        });
    }

    @Test
    void shouldRejectSsoAccountWhoseEmailDiffersFromSignupForm() {
        assertThatThrownBy(() -> handler.handle(requestWith(payload("someone@acme.com", "Acme", "acme")),
                response, authentication("google", owner)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("owner@acme.com")
                .hasMessageContaining("someone@acme.com");
        verify(registrationService, never()).registerTenant(any());
    }

    @Test
    void shouldAllowCookieWithoutFormEmail() {
        when(registrationService.registerTenant(any())).thenReturn(tenant("t", TenantStatus.ACTIVE));

        handler.handle(requestWith(payload(null, "Acme", "acme")), response, authentication("google", owner));

        verify(registrationService).registerTenant(any());
    }

    @Test
    void shouldRefuseAlreadyLinkedIdentity() {
        doThrow(new SsoAlreadyLinkedException()).when(ssoIdentityService).ensureNotAlreadyLinked(eq("google"), anyMap());

        assertThatThrownBy(() -> handler.handle(requestWith(payload("owner@acme.com", "Acme", "acme")),
                response, authentication("google", owner)))
                .isInstanceOf(SsoAlreadyLinkedException.class);
        verify(registrationService, never()).registerTenant(any());
    }

    @Test
    void shouldCheckLinkAgainstAuthenticatedProviderNotCookieProvider() {
        when(registrationService.registerTenant(any())).thenReturn(tenant("t", TenantStatus.ACTIVE));

        handler.handle(requestWith(payload("owner@acme.com", "Acme", "acme")), response, authentication("microsoft", owner));

        verify(ssoIdentityService).ensureNotAlreadyLinked(eq("microsoft"), anyMap());
    }

    @Test
    void shouldRejectCookieMissingTenantDetails() {
        assertThatThrownBy(() -> handler.handle(requestWith(payload("owner@acme.com", null, "acme")),
                response, authentication("google", owner)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Missing registration details");
        verify(registrationService, never()).registerTenant(any());
    }

    @Test
    void shouldRequireFlowCookie() {
        MockHttpServletRequest request = bind(new MockHttpServletRequest());

        assertThatThrownBy(() -> handler.handle(request, response, authentication("google", owner)))
                .hasMessageContaining("SSO session expired");
    }

    @Test
    void shouldRequireEmailFromProvider() {
        OidcUser noEmail = oidcUser(Map.of("given_name", "Ada"));

        assertThatThrownBy(() -> handler.handle(requestWith(payload(null, "Acme", "acme")),
                response, authentication("google", noEmail)))
                .hasMessageContaining("Email not provided");
    }

    @Test
    void shouldRequireOidcPrincipal() {
        assertThatThrownBy(() -> handler.handle(requestWith(payload(null, "Acme", "acme")), response,
                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken("u", "p")))
                .hasMessageContaining("Please use SSO login");
    }
}
