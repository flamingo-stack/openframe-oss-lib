package com.openframe.authz.web;

import com.openframe.authz.service.auth.AuthErrorDetailStore;
import com.openframe.core.exception.AuthFlowException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.test.util.ReflectionTestUtils;

import static com.openframe.authz.support.ServletTestSupport.bind;
import static com.openframe.authz.support.ServletTestSupport.unbind;
import static com.openframe.core.exception.AuthErrorCode.ACCOUNT_INACTIVE;
import static com.openframe.core.exception.AuthErrorCode.ACCOUNT_NOT_FOUND;
import static com.openframe.core.exception.AuthErrorCode.REGISTRATION_FAILED;
import static com.openframe.core.exception.AuthErrorCode.SSO_LOGIN_FAILED;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthWebHelpersTest {

    private static final String ERROR_URL = "https://app.example.com/auth/error";
    private static final String NOT_FOUND_DETAIL = "No account found for a@acme.com. Please sign up first.";

    @Mock
    private AuthErrorDetailStore detailStore;

    @AfterEach
    void tearDown() {
        unbind();
    }

    private AuthErrorResponder responder() {
        AuthErrorResponder responder = new AuthErrorResponder(detailStore);
        ReflectionTestUtils.setField(responder, "authErrorUrl", ERROR_URL);
        return responder;
    }

    @Test
    void shouldRedirectWithProviderCodeAndNeverStoreOrShowTheProviderDescription() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        OAuth2AuthenticationException providerError = new OAuth2AuthenticationException(
                new OAuth2Error("server_error", "Your account is suspended. Call +1-555-0100", null),
                "Your account is suspended. Call +1-555-0100");

        responder().send(response, new MockHttpServletRequest(), "oauth2-login", providerError, SSO_LOGIN_FAILED);

        assertThat(response.getRedirectedUrl())
                .isEqualTo(ERROR_URL + "?ref=PROVIDER_ERROR")
                .doesNotContain("suspended");
        verifyNoInteractions(detailStore);
    }

    @Test
    void shouldRedirectWithCodeOnlyWhenProviderGaveNoDescription() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        OAuth2AuthenticationException cancelled = new OAuth2AuthenticationException(new OAuth2Error("access_denied"));

        responder().send(response, new MockHttpServletRequest(), "oauth2-login", cancelled, SSO_LOGIN_FAILED);

        assertThat(response.getRedirectedUrl()).isEqualTo(ERROR_URL + "?ref=PROVIDER_ACCESS_DENIED");
        verifyNoInteractions(detailStore);
    }

    @Test
    void shouldMapConsentFailureAndLostAuthorizationRequestToTheirOwnCodes() throws Exception {
        MockHttpServletResponse consent = new MockHttpServletResponse();
        MockHttpServletResponse lost = new MockHttpServletResponse();
        OAuth2AuthenticationException consentError = new OAuth2AuthenticationException(
                new OAuth2Error("invalid_request", "AADSTS650056: Misconfigured application", null));
        OAuth2AuthenticationException lostError = new OAuth2AuthenticationException(
                new OAuth2Error("authorization_request_not_found"));

        responder().send(consent, new MockHttpServletRequest(), "oauth2-login", consentError, SSO_LOGIN_FAILED);
        responder().send(lost, new MockHttpServletRequest(), "oauth2-login", lostError, SSO_LOGIN_FAILED);

        assertThat(consent.getRedirectedUrl()).isEqualTo(ERROR_URL + "?ref=PROVIDER_CONSENT_REQUIRED");
        assertThat(lost.getRedirectedUrl()).isEqualTo(ERROR_URL + "?ref=SSO_SESSION_EXPIRED");
        verifyNoInteractions(detailStore);
    }

    @Test
    void shouldUseCodeCarriedByFlowExceptionWithoutStoringItsStaticMessage() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        AuthFlowException failure = new AuthFlowException(ACCOUNT_INACTIVE, "Your account is not active.");

        responder().send(response, new MockHttpServletRequest(), "sso-flow-finalize", failure, REGISTRATION_FAILED);

        assertThat(response.getRedirectedUrl()).isEqualTo(ERROR_URL + "?ref=ACCOUNT_INACTIVE");
        verifyNoInteractions(detailStore);
    }

    @Test
    void shouldStoreFlowDetailBehindReference() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        AuthFlowException failure = AuthFlowException.withDetail(ACCOUNT_NOT_FOUND, NOT_FOUND_DETAIL);
        when(detailStore.save(ACCOUNT_NOT_FOUND, NOT_FOUND_DETAIL)).thenReturn("ref-3");

        responder().send(response, new MockHttpServletRequest(), "sso-flow-finalize", failure, REGISTRATION_FAILED);

        assertThat(response.getRedirectedUrl())
                .isEqualTo(ERROR_URL + "?ref=ref-3")
                .doesNotContain("acme");
    }

    @Test
    void shouldRedirectWithCodeOnlyWhenDetailStoreFails() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        AuthFlowException failure = AuthFlowException.withDetail(ACCOUNT_NOT_FOUND, NOT_FOUND_DETAIL);
        when(detailStore.save(ACCOUNT_NOT_FOUND, NOT_FOUND_DETAIL)).thenThrow(new IllegalStateException("redis down"));

        responder().send(response, new MockHttpServletRequest(), "sso-flow-finalize", failure, REGISTRATION_FAILED);

        assertThat(response.getRedirectedUrl()).isEqualTo(ERROR_URL + "?ref=ACCOUNT_NOT_FOUND");
    }

    @Test
    void shouldFallBackToCallSiteCodeAndNeverPutTheMessageInTheUrl() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        IllegalStateException failure = new IllegalStateException("Your account is suspended. Call +1-555-0100");

        responder().send(response, new MockHttpServletRequest(), "sso-login-init", failure, SSO_LOGIN_FAILED);

        assertThat(response.getRedirectedUrl())
                .isEqualTo(ERROR_URL + "?ref=SSO_LOGIN_FAILED")
                .doesNotContain("suspended");
        verifyNoInteractions(detailStore);
    }

    @Test
    void shouldClassifyFailuresForLogsOnly() {
        AuthErrorResponder responder = responder();

        assertThat((String) ReflectionTestUtils.invokeMethod(responder, "classify", new IllegalStateException("x"))).isEqualTo("USER_INPUT");
        assertThat((String) ReflectionTestUtils.invokeMethod(responder, "classify",
                new OAuth2AuthenticationException(new OAuth2Error("access_denied")))).isEqualTo("PROVIDER_CANCELLED");
        assertThat((String) ReflectionTestUtils.invokeMethod(responder, "classify",
                new OAuth2AuthenticationException(new OAuth2Error("invalid_request", "AADSTS650056: Misconfigured application", null))))
                .isEqualTo("PROVIDER_CONSENT");
        assertThat((String) ReflectionTestUtils.invokeMethod(responder, "classify",
                new OAuth2AuthenticationException(new OAuth2Error("server_error")))).isEqualTo("PROVIDER_ERROR");
        assertThat((String) ReflectionTestUtils.invokeMethod(responder, "classify", new RuntimeException())).isEqualTo("UNEXPECTED");
    }

    @Test
    void shouldBuildContinuePathWithEncodedParameters() {
        assertThat(Redirects.oauthContinuePath("acme", null, false)).isEqualTo("/oauth/continue?tenantId=acme");
        assertThat(Redirects.oauthContinuePath("a&b", "https://x.com/?q=1", true))
                .isEqualTo("/oauth/continue?tenantId=a%26b&redirectTo=https%3A%2F%2Fx.com%2F%3Fq%3D1&authMobile=true");
    }

    @Test
    void shouldRedirectAtServerRootIgnoringContextPathAndQuery() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/sas/oauth/join/complete");
        request.setContextPath("/sas");
        request.setQueryString("agreeTerms=true");
        bind(request);
        MockHttpServletResponse response = new MockHttpServletResponse();

        Redirects.foundAtRoot(response, "/oauth/continue?tenantId=acme");

        assertThat(response.getStatus()).isEqualTo(302);
        assertThat(response.getHeader("Location")).isEqualTo("https://auth.example.com/oauth/continue?tenantId=acme");
    }

    @Test
    void shouldRedirectWithinContextPath() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/sas/oauth/login/sso");
        request.setContextPath("/sas");
        bind(request);
        MockHttpServletResponse response = new MockHttpServletResponse();

        Redirects.seeOther(response, "/oauth2/authorization/google");

        assertThat(response.getStatus()).isEqualTo(303);
        assertThat(response.getHeader("Location")).isEqualTo("https://auth.example.com/sas/oauth2/authorization/google");
    }
}
