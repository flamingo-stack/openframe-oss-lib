package com.openframe.security.cookie;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpCookie;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Service;
import org.springframework.util.MultiValueMap;
import org.springframework.web.server.ServerWebExchange;

import static com.openframe.security.oauth.SecurityConstants.ACCESS_TOKEN;
import static com.openframe.security.oauth.SecurityConstants.REFRESH_TOKEN;
import static org.springframework.http.HttpHeaders.SET_COOKIE;

/**
 * Service for managing HTTP cookies used for authentication tokens.
 * Handles setting, getting, and clearing access and refresh token cookies.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CookieService {

    public static final String ACCESS_TOKEN_COOKIE = "access_token";
    public static final String REFRESH_TOKEN_COOKIE = "refresh_token";
    public static final String JSESSIONID = "JSESSIONID";
    private static final String OAUTH_STATE_COOKIE_PREFIX = "of_oauth_";

    @Value("${security.oauth2.token.access.expiration-seconds}")
    private int accessTokenExpirationSeconds;

    @Value("${security.oauth2.token.refresh.expiration-seconds}")
    private int refreshTokenExpirationSeconds;

    @Value("${openframe.security.cookie.domain:#{null}}")
    private String domain;

    @Value("${openframe.security.cookie.secure:false}")
    private boolean cookieSecure;

    @Value("${openframe.security.cookie.same-site:Lax}")
    private String cookieSameSite;


    public void addAuthCookies(HttpHeaders headers, String accessToken, String refreshToken) {
        ResponseCookie access = createAccessTokenCookie(accessToken);
        ResponseCookie refresh = createRefreshTokenCookie(refreshToken);
        headers.add(SET_COOKIE, access.toString());
        headers.add(SET_COOKIE, refresh.toString());
    }

    public void addClearAuthCookies(HttpHeaders headers) {
        ResponseCookie clearedAccess = createClearedCookie(ACCESS_TOKEN, "/");
        ResponseCookie clearedRefresh = createClearedCookie(REFRESH_TOKEN, "/oauth");
        ResponseCookie clearedAuthSession = createClearedCookie(JSESSIONID, "/sas");
        ResponseCookie clearedAuthSessionHostOnly = createClearedCookieHostOnly(JSESSIONID, "/sas");

        headers.add(SET_COOKIE, clearedAccess.toString());
        headers.add(SET_COOKIE, clearedRefresh.toString());
        headers.add(SET_COOKIE, clearedAuthSession.toString());
        headers.add(SET_COOKIE, clearedAuthSessionHostOnly.toString());
    }

    public void addClearSasCookies(HttpHeaders headers) {
        ResponseCookie clearedAuthSession = createClearedCookie(JSESSIONID, "/sas");
        ResponseCookie clearedAuthSessionHostOnly = createClearedCookieHostOnly(JSESSIONID, "/sas");
        headers.add(SET_COOKIE, clearedAuthSession.toString());
        headers.add(SET_COOKIE, clearedAuthSessionHostOnly.toString());
    }

    /**
     * Adds a short-lived signed OAuth state cookie bound to the specific state value.
     * Cookie name format: of_oauth_{state}, Path=/oauth
     */
    public void addOAuthStateCookie(HttpHeaders headers, String state, String jwtValue, int ttlSeconds) {
        String name = OAUTH_STATE_COOKIE_PREFIX + state;
        ResponseCookie cookie = ResponseCookie.from(name, jwtValue)
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite(cookieSameSite)
                .path("/oauth")
                .maxAge(ttlSeconds)
                .domain(domain)
                .build();
        headers.add(SET_COOKIE, cookie.toString());
    }

    /**
     * Clears the OAuth state cookie for given state.
     */
    public void addClearOAuthStateCookie(HttpHeaders headers, String state) {
        String name = OAUTH_STATE_COOKIE_PREFIX + state;
        ResponseCookie cleared = createClearedCookie(name, "/oauth");
        headers.add(SET_COOKIE, cleared.toString());
    }


    private ResponseCookie createAccessTokenCookie(String accessToken) {
        return createCookie(ACCESS_TOKEN_COOKIE, accessToken, "/", accessTokenExpirationSeconds);
    }

    private ResponseCookie createRefreshTokenCookie(String refreshToken) {
        return createCookie(REFRESH_TOKEN_COOKIE, refreshToken, "/oauth", refreshTokenExpirationSeconds);
    }

    private ResponseCookie createCookie(String name, String value, String path, int age) {
        return createCookie(name, value, path, age, true);
    }

    private ResponseCookie createCookie(String name, String value, String path, int age, boolean includeDomain) {
        return ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite(cookieSameSite)
                .path(path)
                .maxAge(age)
                .domain(includeDomain ? domain : null)
                .build();
    }

    private ResponseCookie createClearedCookie(String name, String path) {
        return createCookie(name, "", path, 0);
    }

    private ResponseCookie createClearedCookieHostOnly(String name, String path) {
        return createCookie(name, "", path, 0, false);
    }

    /**
     * Get JWT access token from reactive ServerWebExchange cookies
     * This is automatically sent by browser on every request
     */
    public String getAccessTokenFromCookies(ServerWebExchange exchange) {
        return getCookieValueFromExchange(exchange, ACCESS_TOKEN_COOKIE);
    }

    /**
     * Common method to extract cookie value from ServerWebExchange
     *
     * @param exchange   the ServerWebExchange containing the request
     * @param cookieName the name of the cookie to extract
     * @return cookie value or null if not found
     */
    private String getCookieValueFromExchange(ServerWebExchange exchange, String cookieName) {
        ServerHttpRequest request = exchange.getRequest();
        MultiValueMap<String, HttpCookie> cookies = request.getCookies();

        HttpCookie cookie = cookies.getFirst(cookieName);
        if (cookie != null) {
            log.debug("Found {} cookie in request", cookieName);
            return cookie.getValue();
        }

        log.debug("Cookie {} not found in request", cookieName);
        return null;
    }
} 