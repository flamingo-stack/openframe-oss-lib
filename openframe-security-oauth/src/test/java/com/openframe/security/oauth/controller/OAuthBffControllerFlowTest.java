package com.openframe.security.oauth.controller;

import com.openframe.core.constants.SsoFlowCookieNames;
import com.openframe.security.cookie.CookieService;
import com.openframe.security.oauth.dto.OAuthCallbackResult;
import com.openframe.security.oauth.dto.TokenResponse;
import com.openframe.security.oauth.exception.AppleNativeRegistrationRequiredException;
import com.openframe.security.oauth.service.InMemoryOAuthDevTicketStore;
import com.openframe.security.oauth.service.OAuthBffService;
import com.openframe.security.oauth.service.OAuthDevTicketStore;
import com.openframe.security.oauth.service.redirect.RedirectTargetResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.test.util.ReflectionTestUtils;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OAuthBffControllerFlowTest {

    private static final String ACCESS = "access-token";
    private static final String REFRESH = "refresh-token";
    private static final TokenResponse TOKENS = new TokenResponse(ACCESS, REFRESH, "Bearer", 300, "openid");
    private static final String NATIVE_APP = "com.openframe.app://auth";

    @Mock
    private OAuthBffService oauthBffService;
    @Mock
    private RedirectTargetResolver redirectTargetResolver;

    private final OAuthDevTicketStore devTicketStore = new InMemoryOAuthDevTicketStore();
    private OAuthBffController controller;
    private final ServerHttpRequest request = MockServerHttpRequest.get("/oauth/x").build();

    @BeforeEach
    void setUp() {
        CookieService cookieService = new CookieService();
        ReflectionTestUtils.setField(cookieService, "accessTokenExpirationSeconds", 300);
        ReflectionTestUtils.setField(cookieService, "refreshTokenExpirationSeconds", 86400);
        ReflectionTestUtils.setField(cookieService, "cookieSecure", true);
        ReflectionTestUtils.setField(cookieService, "cookieSameSite", "Lax");
        controller = new OAuthBffController(oauthBffService, devTicketStore, cookieService, redirectTargetResolver);
        ReflectionTestUtils.setField(controller, "stateCookieTtlSeconds", 180);
        ReflectionTestUtils.setField(controller, "devTicketEnabled", false);
        ReflectionTestUtils.setField(controller, "mobileAuthEnabled", true);
        ReflectionTestUtils.setField(controller, "authErrorUrl", "https://app.openframe.ai/auth/error");
        ReflectionTestUtils.setField(controller, "signupContinuePage", "/auth/sso-continue");
        ReflectionTestUtils.setField(controller, "joinCancelPage", "/auth/login");
        lenient().when(redirectTargetResolver.isAllowedRedirectUri(NATIVE_APP)).thenReturn(true);
    }

    private static List<String> setCookies(ResponseEntity<?> response) {
        List<String> cookies = response.getHeaders().get(HttpHeaders.SET_COOKIE);
        return cookies == null ? List.of() : cookies;
    }

    private static String location(ResponseEntity<?> response) {
        return response.getHeaders().getFirst(HttpHeaders.LOCATION);
    }

    private void authorizeRedirectReturns(String tenant, boolean authMobile) {
        OAuthBffService.AuthorizeData data = new OAuthBffService.AuthorizeData(
                "https://auth/sas/" + tenant + "/oauth2/authorize?state=st", "st", "cv", tenant, null, authMobile);
        when(oauthBffService.buildAuthorizeRedirect(eq(tenant), any(), any(), anyBoolean(), any())).thenReturn(Mono.just(data));
        when(oauthBffService.buildStateJwt(data, 180)).thenReturn("state-jwt");
    }

    // --- /oauth/login, /oauth/continue ---

    @Test
    void shouldStartLoginClearingSasAndFlowCookiesAndSettingStateCookie() {
        authorizeRedirectReturns("acme", false);

        ResponseEntity<Void> response = controller.login("acme", "/devices", "google", false, request).block();

        assertThat(response.getStatusCode().value()).isEqualTo(302);
        assertThat(location(response)).isEqualTo("https://auth/sas/acme/oauth2/authorize?state=st");
        assertThat(setCookies(response)).anyMatch(c -> c.startsWith("of_oauth_st=state-jwt") && c.contains("Path=/oauth")
                && c.contains("Max-Age=180") && c.contains("HttpOnly") && c.contains("Secure"));
        assertThat(setCookies(response)).anyMatch(c -> c.startsWith("JSESSIONID=;") && c.contains("Path=/sas"));
        for (String flowCookie : SsoFlowCookieNames.ALL) {
            assertThat(setCookies(response)).anyMatch(c -> c.startsWith(flowCookie + "=;") && c.contains("Max-Age=0"));
        }
    }

    @Test
    void shouldHonorMobileFlagOnlyWhenMobileAuthIsEnabled() {
        ReflectionTestUtils.setField(controller, "mobileAuthEnabled", false);
        authorizeRedirectReturns("acme", false);

        controller.login("acme", null, null, true, request).block();

        verify(oauthBffService).buildAuthorizeRedirect(eq("acme"), isNull(), isNull(), eq(false), any());
    }

    @Test
    void shouldContinueWithoutClearingAnyCookie() {
        authorizeRedirectReturns("acme", true);

        ResponseEntity<Void> response = controller.continueFlow("acme", NATIVE_APP, true, request).block();

        assertThat(setCookies(response)).singleElement().satisfies(c -> assertThat(c).startsWith("of_oauth_st=state-jwt"));
        verify(oauthBffService).buildAuthorizeRedirect(eq("acme"), eq(NATIVE_APP), isNull(), eq(true), any());
    }

    // --- /oauth/callback ---

    @Test
    void shouldSetAuthCookiesClearStateAndRedirectOnCallback() {
        when(oauthBffService.handleCallback("code", "st", request))
                .thenReturn(Mono.just(new OAuthCallbackResult("acme", "https://acme.openframe.ai/", TOKENS, false)));

        ResponseEntity<Void> response = controller.callback("code", "st", request).block();

        assertThat(location(response)).isEqualTo("https://acme.openframe.ai/");
        assertThat(setCookies(response)).anyMatch(c -> c.startsWith("access_token=" + ACCESS) && c.contains("Path=/;"));
        assertThat(setCookies(response)).anyMatch(c -> c.startsWith("refresh_token=" + REFRESH) && c.contains("Path=/oauth"));
        assertThat(setCookies(response)).anyMatch(c -> c.startsWith("of_oauth_st=;") && c.contains("Max-Age=0"));
    }

    @Test
    void shouldAppendSingleUseDevTicketForMobileCallback() {
        when(oauthBffService.handleCallback("code", "st", request))
                .thenReturn(Mono.just(new OAuthCallbackResult("acme", NATIVE_APP + "?x=1", TOKENS, true)));

        String target = location(controller.callback("code", "st", request).block());

        assertThat(target).startsWith(NATIVE_APP + "?x=1&devTicket=");
        String ticket = target.substring(target.indexOf("devTicket=") + "devTicket=".length());
        ResponseEntity<Object> exchanged = controller.devExchange(ticket).block();
        assertThat(exchanged.getStatusCode().value()).isEqualTo(204);
        assertThat(exchanged.getHeaders().toSingleValueMap()).containsValues(ACCESS, REFRESH);
        assertThat(controller.devExchange(ticket).block().getStatusCode().value()).isEqualTo(404);
    }

    @Test
    void shouldNotAppendDevTicketForWebCallbackWhenDevTicketsAreOff() {
        when(oauthBffService.handleCallback("code", "st", request))
                .thenReturn(Mono.just(new OAuthCallbackResult("acme", "https://acme.openframe.ai/", TOKENS, false)));

        assertThat(location(controller.callback("code", "st", request).block())).doesNotContain("devTicket");
    }

    @Test
    void shouldFallBackToRootWhenResolverReturnsNothing() {
        when(oauthBffService.handleCallback("code", "st", request))
                .thenReturn(Mono.just(new OAuthCallbackResult("acme", " ", TOKENS, false)));

        assertThat(location(controller.callback("code", "st", request).block())).isEqualTo("/");
    }

    @Test
    void shouldSendCallbackFailureToErrorPageWithoutAuthCookies() {
        when(oauthBffService.handleCallback("code", "st", request))
                .thenReturn(Mono.error(new IllegalStateException("Authentication session expired. Please try again.")));

        ResponseEntity<Void> response = controller.callback("code", "st", request).block();

        assertThat(location(response)).isEqualTo(
                "https://app.openframe.ai/auth/error?error=Authentication+session+expired.+Please+try+again.");
        assertThat(setCookies(response)).noneMatch(c -> c.startsWith("access_token=" + ACCESS));
        assertThat(setCookies(response)).anyMatch(c -> c.startsWith("of_oauth_st=;"));
    }

    // --- /oauth/refresh headers, /oauth/logout ---

    @Test
    void shouldReturnTokenHeadersOnlyForMobileHeaderRefresh() {
        ServerHttpRequest mobile = MockServerHttpRequest.post("/oauth/refresh").header("Refresh-Token", "rt").build();
        when(oauthBffService.refreshTokensByLookup(eq("rt"), any())).thenReturn(Mono.just(TOKENS));
        when(oauthBffService.refreshTokensByLookup(eq("cookie-rt"), any())).thenReturn(Mono.just(TOKENS));

        ResponseEntity<Void> fromHeader = controller.refresh(null, null, mobile).block();
        ResponseEntity<Void> fromCookie = controller.refresh(null, "cookie-rt", request).block();

        assertThat(fromHeader.getStatusCode().value()).isEqualTo(204);
        assertThat(fromHeader.getHeaders().toSingleValueMap()).containsValue(ACCESS);
        assertThat(fromCookie.getHeaders().toSingleValueMap()).doesNotContainValue(ACCESS);
        assertThat(setCookies(fromCookie)).anyMatch(c -> c.startsWith("refresh_token=" + REFRESH));
    }

    @Test
    void shouldClearCookiesAndRevokeOnLogout() {
        when(oauthBffService.revokeRefreshToken("acme", "rt")).thenReturn(Mono.empty());

        ResponseEntity<Void> response = controller.logout("acme", "rt", request).block();

        assertThat(response.getStatusCode().value()).isEqualTo(204);
        assertThat(setCookies(response)).anyMatch(c -> c.startsWith("access_token=;") && c.contains("Max-Age=0"));
        assertThat(setCookies(response)).anyMatch(c -> c.startsWith("refresh_token=;") && c.contains("Path=/oauth"));
        assertThat(setCookies(response)).anyMatch(c -> c.startsWith("JSESSIONID=;") && c.contains("Path=/sas"));
        verify(oauthBffService).revokeRefreshToken("acme", "rt");
    }

    @Test
    void shouldRevokeByLookupWhenLoggingOutWithoutTenant() {
        ServerHttpRequest mobile = MockServerHttpRequest.get("/oauth/logout").header("Refresh-Token", "hdr-rt").build();
        when(oauthBffService.revokeRefreshTokenByLookup("hdr-rt")).thenReturn(Mono.empty());

        assertThat(controller.logout(null, null, mobile).block().getStatusCode().value()).isEqualTo(204);
    }

    // --- dev tickets ---

    @Test
    void shouldHideDevExchangeWhenDevTicketsAndMobileAreOff() {
        ReflectionTestUtils.setField(controller, "mobileAuthEnabled", false);

        assertThat(controller.devExchange("anything").block().getStatusCode().value()).isEqualTo(404);
    }

    @Test
    void shouldAnswerNotFoundForUnknownDevTicket() {
        assertThat(controller.devExchange("unknown").block().getStatusCode().value()).isEqualTo(404);
    }

    // --- mobile allow-list hops ---

    @Test
    void shouldHandSignupTicketOnlyToAllowListedAppUri() {
        ResponseEntity<Void> allowed = controller.signupContinue("tk/1", NATIVE_APP).block();
        ResponseEntity<Void> denied = controller.signupContinue("tk/1", "https://evil.example.com/steal").block();

        assertThat(location(allowed)).isEqualTo(NATIVE_APP + "?signupTicket=tk%2F1");
        assertThat(location(denied)).isEqualTo("/auth/sso-continue");
    }

    @Test
    void shouldAppendSignupTicketWithAmpersandWhenUriHasQuery() {
        when(redirectTargetResolver.isAllowedRedirectUri(NATIVE_APP + "?src=a")).thenReturn(true);

        assertThat(location(controller.signupContinue("tk", NATIVE_APP + "?src=a").block()))
                .isEqualTo(NATIVE_APP + "?src=a&signupTicket=tk");
    }

    @Test
    void shouldBounceJoinCancelIntoAllowListedAppWithReason() {
        assertThat(location(controller.joinReturn(NATIVE_APP, "USER_CANCELED").block())).isEqualTo(NATIVE_APP + "?error=USER_CANCELED");
        assertThat(location(controller.joinReturn(NATIVE_APP, null).block())).isEqualTo(NATIVE_APP);
        assertThat(location(controller.joinReturn("https://evil.example.com", "SESSION_EXPIRED").block())).isEqualTo("/auth/login");
    }

    // --- mobile signup completion and Apple native ---

    @Test
    void shouldCompleteMobileSignupIntoDevTicket() {
        when(oauthBffService.completeSignupTicket(eq("tk"), eq("NewCo"), eq("newco"), any(), any())).thenReturn(Mono.just(TOKENS));

        ResponseEntity<Object> response = controller.completeSignup(
                new OAuthBffController.SignupTicketCompleteRequest("tk", "NewCo", "newco", null), request).block();

        @SuppressWarnings("unchecked")
        String devTicket = ((Map<String, String>) response.getBody()).get("devTicket");
        assertThat(devTicket).isNotBlank();
        assertThat(devTicketStore.consumeTicket(devTicket).block()).isEqualTo(TOKENS);
    }

    @Test
    void shouldValidateAndMapMobileSignupErrors() {
        when(oauthBffService.completeSignupTicket(eq("tk"), any(), any(), any(), any()))
                .thenReturn(Mono.error(new IllegalArgumentException("already_linked")))
                .thenReturn(Mono.error(new IllegalStateException("Sign-up failed. Please try again.")));

        assertThat(controller.completeSignup(new OAuthBffController.SignupTicketCompleteRequest("tk", " ", "d", null), request)
                .block().getStatusCode().value()).isEqualTo(400);
        ResponseEntity<Object> conflict = controller.completeSignup(
                new OAuthBffController.SignupTicketCompleteRequest("tk", "N", "d", null), request).block();
        assertThat(conflict.getStatusCode().value()).isEqualTo(400);
        assertThat(conflict.getBody()).isEqualTo(Map.of("error", "already_linked"));
        assertThat(controller.completeSignup(new OAuthBffController.SignupTicketCompleteRequest("tk", "N", "d", null), request)
                .block().getStatusCode().value()).isEqualTo(401);
    }

    @Test
    void shouldHideMobileEndpointsWhenMobileAuthIsOff() {
        ReflectionTestUtils.setField(controller, "mobileAuthEnabled", false);

        assertThat(controller.completeSignup(new OAuthBffController.SignupTicketCompleteRequest("tk", "N", "d", null), request)
                .block().getStatusCode().value()).isEqualTo(404);
        assertThat(controller.appleNativeExchange(new OAuthBffController.AppleNativeExchangeRequest(
                "acme", "id", "code", "n", null, null), request).block().getStatusCode().value()).isEqualTo(404);
        assertThat(controller.appleNativeRegister(new OAuthBffController.AppleNativeRegisterRequest(
                "id", "code", "n", null, null, "N", "d"), request).block().getStatusCode().value()).isEqualTo(404);
    }

    @Test
    void shouldExchangeAppleIdentityWithKnownTenantAndReturnCookiesAndHeaders() {
        when(oauthBffService.appleNativeExchange(eq("acme"), eq("id"), eq("code"), eq("n"), any(), any(), any()))
                .thenReturn(Mono.just(TOKENS));

        ResponseEntity<Object> response = controller.appleNativeExchange(
                new OAuthBffController.AppleNativeExchangeRequest("acme", "id", "code", "n", null, null), request).block();

        assertThat(response.getStatusCode().value()).isEqualTo(204);
        assertThat(response.getHeaders().toSingleValueMap()).containsValues(ACCESS, REFRESH);
        verify(oauthBffService, never()).appleNativeDiscoverTenant(anyString(), any(), any());
    }

    @Test
    void shouldDiscoverTenantForHideMyEmailUsersAndSignalRegistration() {
        when(oauthBffService.appleNativeDiscoverTenant(eq("id"), eq("n"), any()))
                .thenReturn(Mono.just("found"))
                .thenReturn(Mono.error(new AppleNativeRegistrationRequiredException()));
        when(oauthBffService.appleNativeExchange(eq("found"), any(), any(), any(), any(), any(), any())).thenReturn(Mono.just(TOKENS));
        OAuthBffController.AppleNativeExchangeRequest noTenant =
                new OAuthBffController.AppleNativeExchangeRequest(null, "id", "code", "n", null, null);

        assertThat(controller.appleNativeExchange(noTenant, request).block().getStatusCode().value()).isEqualTo(204);
        ResponseEntity<Object> unknown = controller.appleNativeExchange(noTenant, request).block();
        assertThat(unknown.getStatusCode().value()).isEqualTo(409);
        assertThat(unknown.getBody()).isEqualTo(Map.of("error", "registration_required"));
    }

    @Test
    void shouldMapAppleFailuresToUnauthorizedAndValidateInput() {
        when(oauthBffService.appleNativeExchange(eq("acme"), any(), any(), any(), any(), any(), any()))
                .thenReturn(Mono.error(new IllegalStateException("Apple sign-in failed. Please try again.")));

        assertThat(controller.appleNativeExchange(new OAuthBffController.AppleNativeExchangeRequest(
                "acme", "id", "code", "n", null, null), request).block().getStatusCode().value()).isEqualTo(401);
        assertThat(controller.appleNativeExchange(new OAuthBffController.AppleNativeExchangeRequest(
                "acme", " ", "code", "n", null, null), request).block().getStatusCode().value()).isEqualTo(400);
    }

    @Test
    void shouldRegisterAppleTenantThenExchange() {
        when(oauthBffService.appleNativeRegisterTenant(eq("id"), eq("n"), eq("NewCo"), eq("newco"), any(), any(), any()))
                .thenReturn(Mono.just("newco"));
        when(oauthBffService.appleNativeExchange(eq("newco"), any(), any(), any(), any(), any(), any())).thenReturn(Mono.just(TOKENS));

        ResponseEntity<Object> response = controller.appleNativeRegister(new OAuthBffController.AppleNativeRegisterRequest(
                "id", "code", "n", "Tim", null, "NewCo", "newco"), request).block();

        assertThat(response.getStatusCode().value()).isEqualTo(204);
        assertThat(setCookies(response)).anyMatch(c -> c.startsWith("access_token=" + ACCESS));
    }

    @Test
    void shouldReturnRegistrationErrorMessageToApp() {
        when(oauthBffService.appleNativeRegisterTenant(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(Mono.error(new IllegalArgumentException("This domain is already in use. Please try a different one.")));

        ResponseEntity<Object> response = controller.appleNativeRegister(new OAuthBffController.AppleNativeRegisterRequest(
                "id", "code", "n", null, null, "NewCo", "taken"), request).block();

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(response.getBody()).isEqualTo(Map.of("error", "This domain is already in use. Please try a different one."));
    }

    @Test
    void shouldIssueDistinctSingleUseInMemoryTickets() {
        String first = devTicketStore.createTicket(TOKENS).block();
        String second = devTicketStore.createTicket(TOKENS).block();

        assertThat(first).isNotEqualTo(second);
        assertThat(devTicketStore.consumeTicket(first).block()).isEqualTo(TOKENS);
        assertThat(devTicketStore.consumeTicket(first).block()).isNull();
    }
}
