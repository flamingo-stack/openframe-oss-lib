package com.openframe.authz.security;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import static org.springframework.http.HttpHeaders.SET_COOKIE;

/**
 * Writes the short-lived SSO flow cookies ({@code of_sso_reg}, {@code of_sso_invite}).
 * <p>
 * SameSite is configurable because it depends on how the provider returns the authorization
 * response. Google and Microsoft use the query response mode, so the callback is a top-level GET
 * and {@code Lax} is enough. Apple mandates {@code response_mode=form_post} whenever the {@code email}
 * or {@code name} scope is requested, making the callback a cross-site POST that carries no Lax
 * cookie — that configuration needs {@code None}, together with the same setting on the session
 * cookie (see {@code server.servlet.session.cookie.same-site}).
 * <p>
 * Keep this at {@code Lax} until a form_post provider is actually enabled: {@code None} exposes the
 * cookie to every cross-site request, and this filter chain has CSRF disabled.
 */
@Component
public class SsoFlowCookies {

    private final String sameSite;

    public SsoFlowCookies(@Value("${openframe.sso.flow-cookie.same-site:Lax}") String sameSite) {
        this.sameSite = sameSite;
    }

    public void write(HttpServletResponse response, String name, String value, int ttlSeconds) {
        ResponseCookie cookie = ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(true)
                .path("/")
                .maxAge(ttlSeconds)
                .sameSite(sameSite)
                .build();
        response.addHeader(SET_COOKIE, cookie.toString());
    }
}
