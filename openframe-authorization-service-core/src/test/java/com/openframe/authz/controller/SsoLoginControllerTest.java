package com.openframe.authz.controller;

import com.openframe.authz.dto.TenantRegistrationRequest;
import com.openframe.authz.security.SsoCookieCodec;
import com.openframe.authz.security.SsoFlowCookies;
import com.openframe.authz.security.SsoLoginCookiePayload;
import com.openframe.authz.service.sso.SignupTicketService;
import com.openframe.authz.service.sso.SignupTicketService.SignupTicketPayload;
import com.openframe.authz.service.sso.SsoAlreadyLinkedException;
import com.openframe.authz.service.sso.SsoAuthorizeData;
import com.openframe.authz.service.sso.SsoIdentityService;
import com.openframe.authz.service.sso.SsoLoginService;
import com.openframe.authz.service.tenant.TenantRegistrationService;
import com.openframe.authz.web.AuthErrorResponder;
import com.openframe.core.constants.SsoFlowCookieNames;
import com.openframe.data.document.auth.SsoIdentity;
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
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.Optional;

import static com.openframe.authz.support.ServletTestSupport.bind;
import static com.openframe.authz.support.ServletTestSupport.unbind;
import static com.openframe.authz.support.SsoTestFixtures.authentication;
import static com.openframe.authz.support.SsoTestFixtures.cookieCodec;
import static com.openframe.authz.support.SsoTestFixtures.inTenMinutes;
import static com.openframe.authz.support.SsoTestFixtures.oidcUser;
import static com.openframe.authz.support.SsoTestFixtures.tenant;
import static com.openframe.core.exception.AuthErrorCode.REGISTRATION_FAILED;
import static com.openframe.core.exception.AuthErrorCode.SSO_LOGIN_FAILED;
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
class SsoLoginControllerTest {

    @Mock
    private SsoLoginService ssoLoginService;
    @Mock
    private SignupTicketService signupTicketService;
    @Mock
    private SsoIdentityService ssoIdentityService;
    @Mock
    private TenantRegistrationService registrationService;
    @Mock
    private AuthErrorResponder authErrorResponder;

    private final SsoCookieCodec codec = cookieCodec();
    private SsoLoginController controller;
    private final MockHttpServletResponse response = new MockHttpServletResponse();
    private final Authentication session = authentication("google", oidcUser(Map.of(
            "email", "Founder@NewCo.com", "email_verified", true, "given_name", "Fo", "family_name", "Under")));

    @BeforeEach
    void setUp() {
        controller = new SsoLoginController(ssoLoginService, signupTicketService, ssoIdentityService,
                new SsoFlowCookies("Lax"), codec, registrationService, authErrorResponder);
    }

    @AfterEach
    void tearDown() {
        unbind();
    }

    private MockHttpServletRequest withLoginCookie() {
        MockHttpServletRequest request = bind(new MockHttpServletRequest("GET", "/oauth/login/sso/complete"));
        request.setCookies(new Cookie(SsoFlowCookieNames.OF_SSO_LOGIN, codec.encodeLogin(
                new SsoLoginCookiePayload("s", "google", "/start", false, 1L, inTenMinutes()))));
        return request;
    }

    private static void assertStatus(Runnable call, HttpStatus status) {
        assertThatThrownBy(call::run).isInstanceOfSatisfying(ResponseStatusException.class,
                e -> assertThat(e.getStatusCode()).isEqualTo(status));
    }

    @Test
    void shouldStartLoginWithFreshFlowCookieAndProviderRedirect() throws Exception {
        MockHttpServletRequest request = bind(new MockHttpServletRequest("GET", "/oauth/login/sso"));
        when(ssoLoginService.startLogin(any())).thenReturn(
                new SsoAuthorizeData("cookie-value", 600, "google", "state", "/oauth2/authorization/google?tenant=sso-onboarding"));

        controller.startSsoLogin(new com.openframe.authz.dto.SsoLoginInitRequest(), request, response);

        assertThat(response.getStatus()).isEqualTo(303);
        assertThat(response.getHeader("Location")).endsWith("/oauth2/authorization/google?tenant=sso-onboarding");
        assertThat(response.getHeaders("Set-Cookie")).anyMatch(h -> h.startsWith("of_sso_login=cookie-value"));
        assertThat(response.getCookies()).filteredOn(c -> c.getMaxAge() == 0).extracting(Cookie::getName)
                .containsExactlyInAnyOrder(SsoFlowCookieNames.OF_SSO_REG, SsoFlowCookieNames.OF_SSO_INVITE);
    }

    @Test
    void shouldSendStartFailureToErrorPage() throws Exception {
        MockHttpServletRequest request = bind(new MockHttpServletRequest());
        when(ssoLoginService.startLogin(any())).thenThrow(new IllegalArgumentException("SSO provider not configured"));

        controller.startSsoLogin(new com.openframe.authz.dto.SsoLoginInitRequest(), request, response);

        verify(authErrorResponder).send(eq(response), eq(request), eq("sso-login-init"), any(), eq(SSO_LOGIN_FAILED));
    }

    @Test
    void shouldDescribePendingIdentityFromSessionOrTicket() {
        when(signupTicketService.peek("tk")).thenReturn(Optional.of(
                new SignupTicketPayload("m@x.com", "M", "X", "apple", true, "a-1", null, null)));

        assertThat(controller.pendingSsoIdentity(null, session, withLoginCookie()).email()).isEqualTo("Founder@NewCo.com");
        assertThat(controller.pendingSsoIdentity("tk", null, bind(new MockHttpServletRequest())).provider()).isEqualTo("apple");
    }

    @Test
    void shouldAnswerConflictForExpiredPendingIdentity() {
        when(signupTicketService.peek("gone")).thenReturn(Optional.empty());

        assertStatus(() -> controller.pendingSsoIdentity("gone", null, bind(new MockHttpServletRequest())), HttpStatus.CONFLICT);
        assertStatus(() -> controller.pendingSsoIdentity(null, session, bind(new MockHttpServletRequest())), HttpStatus.CONFLICT);
        assertStatus(() -> controller.pendingSsoIdentity(null, null, withLoginCookie()), HttpStatus.CONFLICT);
    }

    @Test
    void shouldRegisterTenantFromSessionIdentityAndContinue() throws Exception {
        when(registrationService.registerTenant(any())).thenReturn(tenant("newco", TenantStatus.ACTIVE));

        controller.completeSsoRegistration("NewCo", "NEWCO", null, session, withLoginCookie(), response);

        ArgumentCaptor<TenantRegistrationRequest> reg = ArgumentCaptor.forClass(TenantRegistrationRequest.class);
        verify(registrationService).registerTenant(reg.capture());
        assertThat(reg.getValue().getEmail()).isEqualTo("founder@newco.com");
        assertThat(reg.getValue().getTenantDomain()).isEqualTo("newco");
        assertThat(reg.getValue().isEmailPreVerified()).isTrue();
        assertThat(response.getHeader("Location"))
                .isEqualTo("https://auth.example.com/oauth/continue?tenantId=newco&redirectTo=%2Fstart");
    }

    @Test
    void shouldNotRegisterAlreadyLinkedIdentityOnWeb() throws Exception {
        MockHttpServletRequest request = withLoginCookie();
        doThrow(new SsoAlreadyLinkedException()).when(ssoIdentityService).ensureNotAlreadyLinked(eq("google"), anyMap());

        controller.completeSsoRegistration("NewCo", "newco", null, session, request, response);

        verify(registrationService, never()).registerTenant(any());
        verify(authErrorResponder).send(eq(response), eq(request), eq("sso-login-complete"), any(SsoAlreadyLinkedException.class), eq(REGISTRATION_FAILED));
    }

    @Test
    void shouldValidateMobileCompletionRequest() {
        assertStatus(() -> controller.completeSsoRegistrationByTicket(
                new SsoLoginController.SignupTicketCompleteRequest("tk", "", "newco", null)), HttpStatus.BAD_REQUEST);
    }

    @Test
    void shouldCompleteMobileSignupOnceAndBindTicket() {
        when(signupTicketService.peek("tk")).thenReturn(Optional.of(
                new SignupTicketPayload("Founder@NewCo.com", "Fo", null, "google", true, "g-1", null, null)));
        when(ssoIdentityService.findBySubject("google", "g-1")).thenReturn(Optional.empty());
        Tenant registered = tenant("newco", TenantStatus.ACTIVE);
        registered.setOwnerId("owner-1");
        when(registrationService.registerTenant(any())).thenReturn(registered);

        var result = controller.completeSsoRegistrationByTicket(
                new SsoLoginController.SignupTicketCompleteRequest("tk", "NewCo", "NewCo", null));

        assertThat(result.tenantId()).isEqualTo("newco");
        verify(signupTicketService).bind("tk", "owner-1", "newco");
    }

    @Test
    void shouldReturnSameTenantForAlreadyBoundTicket() {
        when(signupTicketService.peek("tk")).thenReturn(Optional.of(
                new SignupTicketPayload("f@newco.com", "F", "", "google", true, "g-1", "owner-1", "newco")));

        assertThat(controller.completeSsoRegistrationByTicket(
                new SsoLoginController.SignupTicketCompleteRequest("tk", "NewCo", "newco", null)).tenantId()).isEqualTo("newco");
        verify(registrationService, never()).registerTenant(any());
    }

    @Test
    void shouldRefuseMobileSignupOfLinkedSubject() {
        when(signupTicketService.peek("tk")).thenReturn(Optional.of(
                new SignupTicketPayload("f@newco.com", "F", "", "google", true, "g-1", null, null)));
        when(ssoIdentityService.findBySubject("google", "g-1")).thenReturn(Optional.of(SsoIdentity.builder().build()));

        assertThatThrownBy(() -> controller.completeSsoRegistrationByTicket(
                new SsoLoginController.SignupTicketCompleteRequest("tk", "NewCo", "newco", null)))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> {
                    assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(e.getReason()).isEqualTo("already_linked");
                });
        verify(registrationService, never()).registerTenant(any());
    }

    @Test
    void shouldMapRegistrationErrorsToHttpStatus() {
        when(signupTicketService.peek("tk")).thenReturn(Optional.of(
                new SignupTicketPayload("f@newco.com", "F", "", "google", true, null, null, null)));
        when(registrationService.registerTenant(any()))
                .thenThrow(new IllegalArgumentException("This domain is already in use. Please try a different one."))
                .thenThrow(new IllegalStateException("gatekeeping"));

        assertStatus(() -> controller.completeSsoRegistrationByTicket(
                new SsoLoginController.SignupTicketCompleteRequest("tk", "NewCo", "taken", null)), HttpStatus.BAD_REQUEST);
        assertStatus(() -> controller.completeSsoRegistrationByTicket(
                new SsoLoginController.SignupTicketCompleteRequest("tk", "NewCo", "taken", null)), HttpStatus.CONFLICT);
    }
}
