package com.openframe.authz.support;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.authz.security.SsoCookieCodec;
import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.tenant.Tenant;
import com.openframe.data.document.tenant.TenantStatus;
import com.openframe.data.document.user.UserRole;
import com.openframe.data.document.user.UserStatus;
import jakarta.servlet.http.Cookie;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Shared builders for auth tests: OIDC users and tokens as the providers would hand them over,
 * a cookie codec wired like the application's, and the documents the flows read.
 */
public final class SsoTestFixtures {

    public static final String COOKIE_SECRET = "test-cookie-secret-0123456789abcdef";

    private SsoTestFixtures() {
    }

    /** The mapper Spring Boot builds: unknown properties are ignored, as in the running app. */
    public static ObjectMapper objectMapper() {
        return Jackson2ObjectMapperBuilder.json().build();
    }

    public static SsoCookieCodec cookieCodec() {
        return cookieCodec(COOKIE_SECRET);
    }

    public static SsoCookieCodec cookieCodec(String secret) {
        SsoCookieCodec codec = new SsoCookieCodec(objectMapper());
        ReflectionTestUtils.setField(codec, "hmacSecret", secret);
        return codec;
    }

    public static OidcUser oidcUser(Map<String, Object> claims) {
        Map<String, Object> all = new HashMap<>(claims);
        all.putIfAbsent("sub", "subject-1");
        Instant now = Instant.now();
        OidcIdToken idToken = new OidcIdToken("id-token-value", now, now.plusSeconds(300), all);
        return new DefaultOidcUser(List.of(), idToken, "sub");
    }

    public static OidcUser oidcUserWithEmail(String email) {
        return oidcUser(Map.of("email", email, "email_verified", true));
    }

    public static OAuth2AuthenticationToken authentication(String registrationId, OidcUser user) {
        return new OAuth2AuthenticationToken(user, user.getAuthorities(), registrationId);
    }

    public static AuthUser activeUser(String id, String tenantId, String email) {
        return AuthUser.builder()
                .id(id)
                .tenantId(tenantId)
                .email(email)
                .status(UserStatus.ACTIVE)
                .roles(List.of(UserRole.ADMIN))
                .build();
    }

    public static Tenant tenant(String id, TenantStatus status) {
        return Tenant.builder()
                .id(id)
                .name("Tenant " + id)
                .domain(id + ".example.com")
                .status(status)
                .build();
    }

    public static Cookie cookie(String name, String value) {
        return new Cookie(name, value);
    }

    public static long inTenMinutes() {
        return Instant.now().plusSeconds(600).getEpochSecond();
    }

    public static long tenMinutesAgo() {
        return Instant.now().minusSeconds(600).getEpochSecond();
    }
}
