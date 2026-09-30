package com.openframe.authz.security;

import com.openframe.authz.service.auth.strategy.SsoProviderRegistry;
import com.openframe.core.constants.SsoFlowCookieNames;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

import java.util.Map;

import static com.openframe.authz.support.SsoTestFixtures.cookieCodec;
import static com.openframe.authz.support.SsoTestFixtures.inTenMinutes;
import static com.openframe.authz.support.SsoTestFixtures.tenMinutesAgo;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SsoAuthorizationRequestResolverTest {

    private final SsoCookieCodec codec = cookieCodec();
    private final SsoProviderRegistry registry = mock(SsoProviderRegistry.class);
    private SsoAuthorizationRequestResolver resolver;

    @BeforeEach
    void setUp() {
        when(registry.additionalAuthorizationParams(anyString())).thenReturn(Map.of());
        resolver = new SsoAuthorizationRequestResolver(
                new InMemoryClientRegistrationRepository(registration("google"), registration("apple")),
                codec, registry);
    }

    private static ClientRegistration registration(String id) {
        return ClientRegistration.withRegistrationId(id)
                .clientId(id + "-client")
                .clientSecret("secret")
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri("https://auth.example.com/login/oauth2/code/" + id)
                .scope("openid", "email")
                .authorizationUri("https://idp.example.com/authorize")
                .tokenUri("https://idp.example.com/token")
                .jwkSetUri("https://idp.example.com/jwks")
                .userNameAttributeName("sub")
                .build();
    }

    private static MockHttpServletRequest request(Cookie... cookies) {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/oauth2/authorization/google");
        request.setServletPath("/oauth2/authorization/google");
        if (cookies.length > 0) {
            request.setCookies(cookies);
        }
        return request;
    }

    private String loginCookie(String state, long exp) {
        return codec.encodeLogin(new SsoLoginCookiePayload(state, "google", null, false, 1L, exp));
    }

    @Test
    void shouldKeepGeneratedStateWithoutFlowCookie() {
        OAuth2AuthorizationRequest req = resolver.resolve(request(), "google");

        assertThat(req).isNotNull();
        assertThat(req.getState()).isNotBlank();
    }

    @Test
    void shouldInjectStateFromValidFlowCookie() {
        Cookie cookie = new Cookie(SsoFlowCookieNames.OF_SSO_LOGIN, loginCookie("flow-state", inTenMinutes()));

        OAuth2AuthorizationRequest req = resolver.resolve(request(cookie), "google");

        assertThat(req.getState()).isEqualTo("flow-state");
    }

    @Test
    void shouldIgnoreExpiredFlowCookie() {
        Cookie cookie = new Cookie(SsoFlowCookieNames.OF_SSO_LOGIN, loginCookie("stale-state", tenMinutesAgo()));

        assertThat(resolver.resolve(request(cookie), "google").getState()).isNotEqualTo("stale-state");
    }

    @Test
    void shouldIgnoreForgedFlowCookie() {
        String forged = cookieCodec("attacker-secret-attacker-secret!").encodeLogin(
                new SsoLoginCookiePayload("attacker-state", "google", null, false, 1L, inTenMinutes()));
        Cookie cookie = new Cookie(SsoFlowCookieNames.OF_SSO_INVITE, forged);

        assertThat(resolver.resolve(request(cookie), "google").getState()).isNotEqualTo("attacker-state");
    }

    @Test
    void shouldIgnoreValidTokenUnderNonFlowCookieName() {
        Cookie cookie = new Cookie("some_other_cookie", loginCookie("smuggled-state", inTenMinutes()));

        assertThat(resolver.resolve(request(cookie), "google").getState()).isNotEqualTo("smuggled-state");
    }

    @Test
    void shouldSkipBlankFlowCookieAndUseTheNextValidOne() {
        Cookie blank = new Cookie(SsoFlowCookieNames.OF_SSO_REG, "");
        Cookie valid = new Cookie(SsoFlowCookieNames.OF_SSO_LOGIN, loginCookie("second-state", inTenMinutes()));

        assertThat(resolver.resolve(request(blank, valid), "google").getState()).isEqualTo("second-state");
    }

    @Test
    void shouldAddProviderSpecificAuthorizationParameters() {
        when(registry.additionalAuthorizationParams("apple")).thenReturn(Map.of("response_mode", "form_post"));

        OAuth2AuthorizationRequest req = resolver.resolve(request(), "apple");

        assertThat(req.getAdditionalParameters()).containsEntry("response_mode", "form_post");
    }

    @Test
    void shouldNotAddParametersForProvidersWithoutExtras() {
        OAuth2AuthorizationRequest req = resolver.resolve(request(), "google");

        assertThat(req.getAdditionalParameters()).doesNotContainKey("response_mode");
    }

    @Test
    void shouldRejectUnknownRegistration() {
        assertThatThrownBy(() -> resolver.resolve(request(), "unknown"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("unknown");
    }

    @Test
    void shouldReturnNullWhenRequestIsNotAnAuthorizationRequest() {
        MockHttpServletRequest other = new MockHttpServletRequest("GET", "/login");
        other.setServletPath("/login");

        assertThat(resolver.resolve(other)).isNull();
    }
}
