package com.openframe.authz.security;

import com.openframe.authz.web.AuthStateUtils;
import com.openframe.core.constants.SsoFlowCookieNames;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.HttpHeaders.SET_COOKIE;

class SsoFlowCookiesTest {

    @Test
    void shouldWriteHttpOnlySecureCookieWithConfiguredSameSiteAndTtl() {
        MockHttpServletResponse response = new MockHttpServletResponse();

        new SsoFlowCookies("Lax").write(response, SsoFlowCookieNames.OF_SSO_LOGIN, "value", 600);

        assertThat(response.getHeader(SET_COOKIE))
                .contains("of_sso_login=value")
                .contains("Path=/")
                .contains("Max-Age=600")
                .contains("Secure")
                .contains("HttpOnly")
                .contains("SameSite=Lax");
    }

    @Test
    void shouldUseSameSiteNoneWhenConfiguredForFormPostProviders() {
        MockHttpServletResponse response = new MockHttpServletResponse();

        new SsoFlowCookies("None").write(response, SsoFlowCookieNames.OF_SSO_INVITE, "value", 600);

        assertThat(response.getHeader(SET_COOKIE)).contains("SameSite=None").contains("Secure");
    }

    @Test
    void shouldClearEveryOtherFlowCookieButKeepTheOneBeingIssued() {
        MockHttpServletResponse response = new MockHttpServletResponse();

        AuthStateUtils.clearOtherSsoFlowCookies(response, SsoFlowCookieNames.OF_SSO_INVITE);

        assertThat(clearedNames(response))
                .containsExactlyInAnyOrder(SsoFlowCookieNames.OF_SSO_REG, SsoFlowCookieNames.OF_SSO_LOGIN);
    }

    @Test
    void shouldClearAllFlowCookies() {
        MockHttpServletResponse response = new MockHttpServletResponse();

        AuthStateUtils.clearSsoFlowCookies(response);

        assertThat(clearedNames(response)).containsExactlyInAnyOrderElementsOf(SsoFlowCookieNames.ALL);
        assertThat(response.getCookies()).allSatisfy(c -> {
            assertThat(c.getMaxAge()).isZero();
            assertThat(c.getPath()).isEqualTo("/");
            assertThat(c.isHttpOnly()).isTrue();
            assertThat(c.getSecure()).isTrue();
        });
    }

    @Test
    void shouldInvalidateSessionAndClearSessionCookieAtRootAndContextPath() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setContextPath("/sas");
        MockHttpSession session = new MockHttpSession();
        request.setSession(session);
        MockHttpServletResponse response = new MockHttpServletResponse();

        AuthStateUtils.clearAuthState(request, response);

        assertThat(session.isInvalid()).isTrue();
        assertThat(response.getCookies())
                .filteredOn(c -> c.getName().equals(AuthStateUtils.JSESSIONID))
                .extracting(Cookie::getPath)
                .containsExactlyInAnyOrder("/", "/sas");
    }

    @Test
    void shouldClearSessionCookieOnlyAtRootWithoutContextPath() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        AuthStateUtils.clearAuthState(request, response);

        assertThat(response.getCookies()).extracting(Cookie::getPath).containsExactly("/");
    }

    private static List<String> clearedNames(MockHttpServletResponse response) {
        return Arrays.stream(response.getCookies())
                .filter(c -> c.getMaxAge() == 0)
                .map(Cookie::getName)
                .toList();
    }
}
