package com.openframe.security;

import com.openframe.core.constants.SsoFlowCookieNames;
import com.openframe.security.cookie.CookieService;
import com.openframe.security.pkce.PKCEUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpCookie;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class SecurityPrimitivesTest {

    private CookieService cookieService;

    @BeforeEach
    void setUp() {
        cookieService = new CookieService();
        ReflectionTestUtils.setField(cookieService, "accessTokenExpirationSeconds", 300);
        ReflectionTestUtils.setField(cookieService, "refreshTokenExpirationSeconds", 86400);
        ReflectionTestUtils.setField(cookieService, "cookieSecure", true);
        ReflectionTestUtils.setField(cookieService, "cookieSameSite", "Lax");
        ReflectionTestUtils.setField(cookieService, "domain", "openframe.ai");
    }

    // --- PKCE ---

    @Test
    void shouldDeriveS256ChallengeAsBase64UrlSha256OfVerifier() throws Exception {
        String verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"; // RFC 7636 appendix B
        String expected = Base64.getUrlEncoder().withoutPadding().encodeToString(
                MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII)));

        assertThat(PKCEUtils.generateCodeChallenge(verifier)).isEqualTo(expected).hasSize(43).doesNotContain("=", "+", "/");
    }

    @Test
    void shouldGenerateUnpredictableUrlSafeVerifiersAndStates() {
        Set<String> verifiers = new HashSet<>();
        Set<String> states = new HashSet<>();
        for (int i = 0; i < 200; i++) {
            verifiers.add(PKCEUtils.generateCodeVerifier());
            states.add(PKCEUtils.generateState());
        }

        assertThat(verifiers).hasSize(200).allMatch(v -> v.matches("^[A-Za-z0-9_-]{43}$"));
        assertThat(states).hasSize(200).allMatch(s -> s.matches("^[A-Za-z0-9_-]{22}$"));
    }

    // --- cookies ---

    private static List<String> setCookies(HttpHeaders headers) {
        return headers.get(HttpHeaders.SET_COOKIE);
    }

    @Test
    void shouldIssueHttpOnlyAuthCookiesWithScopedPaths() {
        HttpHeaders headers = new HttpHeaders();

        cookieService.addAuthCookies(headers, "at", "rt");

        assertThat(setCookies(headers)).containsExactly(
                "access_token=at; Path=/; Domain=openframe.ai; Max-Age=300; Expires=" + expires(setCookies(headers).get(0))
                        + "; Secure; HttpOnly; SameSite=Lax",
                "refresh_token=rt; Path=/oauth; Domain=openframe.ai; Max-Age=86400; Expires=" + expires(setCookies(headers).get(1))
                        + "; Secure; HttpOnly; SameSite=Lax");
    }

    private static String expires(String cookie) {
        int start = cookie.indexOf("Expires=") + "Expires=".length();
        return cookie.substring(start, cookie.indexOf(';', start));
    }

    @Test
    void shouldClearAuthCookiesAndAuthServerSessionForDomainAndHostOnly() {
        HttpHeaders headers = new HttpHeaders();

        cookieService.addClearAuthCookies(headers);

        assertThat(setCookies(headers)).allMatch(c -> c.contains("Max-Age=0"));
        assertThat(setCookies(headers)).anyMatch(c -> c.startsWith("access_token=;") && c.contains("Path=/;"));
        assertThat(setCookies(headers)).anyMatch(c -> c.startsWith("refresh_token=;") && c.contains("Path=/oauth"));
        assertThat(setCookies(headers)).filteredOn(c -> c.startsWith("JSESSIONID=;")).hasSize(2)
                .anyMatch(c -> c.contains("Domain=openframe.ai"))
                .anyMatch(c -> !c.contains("Domain="));
    }

    @Test
    void shouldClearSessionAndEverySsoFlowCookieWhenLoginStarts() {
        HttpHeaders headers = new HttpHeaders();

        cookieService.addClearSasCookies(headers);

        for (String name : SsoFlowCookieNames.ALL) {
            assertThat(setCookies(headers)).filteredOn(c -> c.startsWith(name + "=;")).hasSize(2)
                    .allMatch(c -> c.contains("Max-Age=0") && c.contains("Path=/"));
        }
    }

    @Test
    void shouldScopeStateCookieToOauthPathAndClearIt() {
        HttpHeaders headers = new HttpHeaders();

        cookieService.addOAuthStateCookie(headers, "st", "jwt", 180);
        cookieService.addClearOAuthStateCookie(headers, "st");

        assertThat(setCookies(headers).get(0)).startsWith("of_oauth_st=jwt;").contains("Path=/oauth", "Max-Age=180", "HttpOnly", "Secure");
        assertThat(setCookies(headers).get(1)).startsWith("of_oauth_st=;").contains("Max-Age=0", "Path=/oauth");
    }

    @Test
    void shouldReadAccessTokenFromCookie() {
        MockServerWebExchange with = MockServerWebExchange.from(MockServerHttpRequest.get("/").cookie(new HttpCookie("access_token", "at")));
        MockServerWebExchange without = MockServerWebExchange.from(MockServerHttpRequest.get("/"));

        assertThat(cookieService.getAccessTokenFromCookies(with)).isEqualTo("at");
        assertThat(cookieService.getAccessTokenFromCookies(without)).isNull();
    }
}
