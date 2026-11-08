package com.openframe.authz.config;

import com.openframe.authz.web.AuthErrorResponder;
import com.openframe.core.exception.AuthFlowException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.InternalAuthenticationServiceException;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;

import static com.openframe.core.exception.AuthErrorCode.ACCOUNT_BLOCKED;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class PasswordLoginFailureHandlerTest {

    private final AuthErrorResponder authErrorResponder = mock(AuthErrorResponder.class);
    private final AuthenticationFailureHandler handler = SecurityConfig.passwordLoginFailureHandler(authErrorResponder);

    @Test
    void shouldSendBlockedTenantToTheErrorPageWithItsCode() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/login");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AuthFlowException refusal = new AuthFlowException(ACCOUNT_BLOCKED, ACCOUNT_BLOCKED.getMessage());

        handler.onAuthenticationFailure(request, response,
                new InternalAuthenticationServiceException(ACCOUNT_BLOCKED.getMessage(), refusal));

        verify(authErrorResponder).send(response, request, "password-login", refusal, ACCOUNT_BLOCKED);
    }

    @Test
    void shouldKeepInvalidCredentialsOnTheLoginPage() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/login");
        MockHttpServletResponse response = new MockHttpServletResponse();

        handler.onAuthenticationFailure(request, response, new BadCredentialsException("Bad credentials"));

        assertThat(response.getRedirectedUrl()).isEqualTo("/login?error");
        verify(authErrorResponder, never()).send(any(), any(), any(), any(), any());
    }
}
