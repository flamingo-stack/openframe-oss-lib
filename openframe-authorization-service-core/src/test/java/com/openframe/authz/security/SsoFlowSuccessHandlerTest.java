package com.openframe.authz.security;

import com.openframe.authz.security.flow.SsoFlowHandler;
import com.openframe.authz.service.sso.SsoOidcUserService;
import com.openframe.authz.service.sso.apple.AppleWebTokenCapture;
import com.openframe.authz.web.AuthErrorResponder;
import com.openframe.core.constants.SsoFlowCookieNames;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static com.openframe.authz.support.SsoTestFixtures.authentication;
import static com.openframe.authz.support.SsoTestFixtures.oidcUser;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class SsoFlowSuccessHandlerTest {

    @Mock
    private AuthErrorResponder authErrorResponder;
    @Mock
    private SsoOidcUserService ssoOidcUserService;
    @Mock
    private AppleWebTokenCapture appleWebTokenCapture;
    @Mock
    private MicrosoftLoginEmailGate microsoftLoginEmailGate;
    @Mock
    private SsoIdentityCapture ssoIdentityCapture;

    private RecordingHandler inviteHandler;
    private RecordingHandler loginHandler;
    private SsoFlowSuccessHandler successHandler;

    private final Authentication authentication = authentication("google", oidcUser(Map.of("email", "a@acme.com")));
    private final MockHttpServletResponse response = new MockHttpServletResponse();

    @BeforeEach
    void setUp() {
        inviteHandler = new RecordingHandler(SsoFlowCookieNames.OF_SSO_INVITE, "invite-state");
        loginHandler = new RecordingHandler(SsoFlowCookieNames.OF_SSO_LOGIN, "login-state");
        successHandler = new SsoFlowSuccessHandler(List.of(loginHandler, inviteHandler), authErrorResponder,
                appleWebTokenCapture, microsoftLoginEmailGate, ssoIdentityCapture, ssoOidcUserService);
    }

    private static MockHttpServletRequest callback(String state, Cookie... cookies) {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/login/oauth2/code/google");
        if (state != null) {
            request.setParameter("state", state);
        }
        if (cookies.length > 0) {
            request.setCookies(cookies);
        }
        return request;
    }

    @Test
    void shouldDispatchByEchoedStateNotByCookiePresence() throws Exception {
        MockHttpServletRequest request = callback("invite-state",
                new Cookie(SsoFlowCookieNames.OF_SSO_LOGIN, "stale"),
                new Cookie(SsoFlowCookieNames.OF_SSO_INVITE, "current"));

        successHandler.onAuthenticationSuccess(request, response, authentication);

        assertThat(inviteHandler.handled).isTrue();
        assertThat(loginHandler.handled).isFalse();
        verify(appleWebTokenCapture).captureIfApple(request, authentication);
    }

    @Test
    void shouldRejectCallbackWhoseStateMatchesNoFlowCookie() throws Exception {
        MockHttpServletRequest request = callback("replayed-state", new Cookie(SsoFlowCookieNames.OF_SSO_LOGIN, "stale"));

        successHandler.onAuthenticationSuccess(request, response, authentication);

        assertThat(inviteHandler.handled || loginHandler.handled).isFalse();
        assertThat(clearedCookies()).containsExactlyInAnyOrderElementsOf(SsoFlowCookieNames.ALL);
        verify(authErrorResponder).send(eq(response), eq(request), eq("sso-flow-state-mismatch"), any(), anyString());
        verify(ssoIdentityCapture, never()).capture(any());
    }

    @Test
    void shouldTreatMissingStateWithFlowCookieAsMismatch() throws Exception {
        MockHttpServletRequest request = callback(null, new Cookie(SsoFlowCookieNames.OF_SSO_INVITE, "current"));

        successHandler.onAuthenticationSuccess(request, response, authentication);

        assertThat(inviteHandler.handled).isFalse();
        verify(authErrorResponder).send(eq(response), eq(request), eq("sso-flow-state-mismatch"), any(), anyString());
    }

    @Test
    void shouldRunGateThenCapturesForPlainLoginWithoutFlowCookie() throws Exception {
        MockHttpServletRequest request = callback("spring-state");

        successHandler.onAuthenticationSuccess(request, response, authentication);

        InOrder order = inOrder(microsoftLoginEmailGate, appleWebTokenCapture, ssoIdentityCapture);
        order.verify(microsoftLoginEmailGate).require(authentication);
        order.verify(appleWebTokenCapture).captureIfApple(request, authentication);
        order.verify(ssoIdentityCapture).capture(authentication);
        assertThat(response.getRedirectedUrl()).isEqualTo("/");
    }

    @Test
    void shouldStopPlainLoginRejectedByMicrosoftGate() throws Exception {
        MockHttpServletRequest request = callback("spring-state");
        doThrow(new IllegalStateException("not verified")).when(microsoftLoginEmailGate).require(authentication);

        successHandler.onAuthenticationSuccess(request, response, authentication);

        verify(authErrorResponder).send(eq(response), eq(request), eq("sso-login-unverified-email"), any(), anyString());
        verify(ssoIdentityCapture, never()).capture(any());
        verify(appleWebTokenCapture, never()).captureIfApple(any(), any());
    }

    @Test
    void shouldClearFlowCookiesAndReportHandlerFailureVerbatim() throws Exception {
        inviteHandler.failure = new IllegalStateException("Invitation expired");
        MockHttpServletRequest request = callback("invite-state", new Cookie(SsoFlowCookieNames.OF_SSO_INVITE, "c"));

        successHandler.onAuthenticationSuccess(request, response, authentication);

        assertThat(clearedCookies()).containsExactlyInAnyOrderElementsOf(SsoFlowCookieNames.ALL);
        verify(authErrorResponder).send(eq(response), eq(request), eq("sso-flow-finalize"),
                eq(inviteHandler.failure), anyString());
        verify(appleWebTokenCapture, never()).captureIfApple(any(), any());
    }

    private List<String> clearedCookies() {
        return Arrays.stream(response.getCookies()).filter(c -> c.getMaxAge() == 0).map(Cookie::getName).toList();
    }

    /** Minimal flow handler whose cookie value is irrelevant: the state it expects is fixed. */
    private static final class RecordingHandler implements SsoFlowHandler {
        private final String cookieName;
        private final String state;
        boolean handled;
        Exception failure;

        RecordingHandler(String cookieName, String state) {
            this.cookieName = cookieName;
            this.state = state;
        }

        @Override
        public String cookieName() {
            return cookieName;
        }

        @Override
        public Optional<String> expectedState(Cookie cookie) {
            return Optional.of(state);
        }

        @Override
        public void handle(jakarta.servlet.http.HttpServletRequest request,
                           jakarta.servlet.http.HttpServletResponse response,
                           Authentication authentication) throws Exception {
            if (failure != null) {
                throw failure;
            }
            handled = true;
        }
    }
}
