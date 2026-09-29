package com.openframe.authz.web;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.test.util.ReflectionTestUtils;

import static com.openframe.authz.support.ServletTestSupport.bind;
import static com.openframe.authz.support.ServletTestSupport.unbind;
import static org.assertj.core.api.Assertions.assertThat;

class AuthWebHelpersTest {

    @AfterEach
    void tearDown() {
        unbind();
    }

    private static AuthErrorResponder responder() {
        AuthErrorResponder responder = new AuthErrorResponder();
        ReflectionTestUtils.setField(responder, "authErrorUrl", "https://app.example.com/auth/error");
        return responder;
    }

    @Test
    void shouldShowFailureMessageVerbatimIncludingProviderDescription() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        OAuth2AuthenticationException providerError = new OAuth2AuthenticationException(
                new OAuth2Error("invalid_request", "AADSTS50020: User account from identity provider does not exist", null),
                "AADSTS50020: User account from identity provider does not exist");

        responder().send(response, new MockHttpServletRequest(), "oauth2-login", providerError, "fallback");

        assertThat(response.getRedirectedUrl()).isEqualTo(
                "https://app.example.com/auth/error?error=AADSTS50020%3A+User+account+from+identity+provider+does+not+exist");
    }

    @Test
    void shouldUseFallbackWhenFailureHasNoMessage() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();

        responder().send(response, null, "e", new IllegalStateException(), "Sign-in failed. Please try again.");

        assertThat(response.getRedirectedUrl()).endsWith("?error=Sign-in+failed.+Please+try+again.");
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
