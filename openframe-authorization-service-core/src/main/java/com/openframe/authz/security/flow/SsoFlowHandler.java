package com.openframe.authz.security.flow;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;

import static com.openframe.authz.util.OidcUserUtils.resolveEmail;
import static com.openframe.authz.util.OidcUserUtils.stringClaim;
import static com.openframe.authz.web.AuthStateUtils.clearCookie;
import static com.openframe.authz.web.Redirects.found;
import static java.net.URLEncoder.encode;
import static java.nio.charset.StandardCharsets.UTF_8;
import static java.util.Locale.ROOT;

public interface SsoFlowHandler {
    String cookieName();

    default Cookie resolveCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (Cookie c : cookies) {
            if (cookieName().equals(c.getName())) return c;
        }
        return null;
    }

    default Cookie requireCookie(HttpServletRequest request) {
        Cookie c = resolveCookie(request);
        if (c == null) throw new IllegalStateException("sso_cookie_missing");
        return c;
    }

    default boolean isActivated(HttpServletRequest request) {
        return resolveCookie(request) != null;
    }

    void handle(HttpServletRequest request, HttpServletResponse response, Authentication authentication) throws Exception;

    default OidcUser requireOidcUser(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof OidcUser u) return u;
        throw new IllegalStateException("OIDC principal expected");
    }

    default String requireEmail(OidcUser u) {
        String email = resolveEmail(u);
        if (email == null || email.isBlank()) throw new IllegalStateException("email_not_available");
        return email.toLowerCase(ROOT);
    }

    default String[] resolveNames(OidcUser oidcUser) {
        String givenName = stringClaim(oidcUser.getClaims().get("given_name"));
        String familyName = stringClaim(oidcUser.getClaims().get("family_name"));
        if ((givenName == null || givenName.isBlank()) && (familyName == null || familyName.isBlank())) {
            String full = oidcUser.getFullName();
            if (full != null && !full.isBlank()) {
                String[] parts = full.trim().split("\\s+", 2);
                givenName = parts[0];
                familyName = parts.length > 1 ? parts[1] : "";
            }
        }
        return new String[]{givenName != null ? givenName : "", familyName != null ? familyName : ""};
    }

    default void clearFlowCookieAndRedirect(HttpServletRequest request,
                                            HttpServletResponse response,
                                            Cookie flowCookie,
                                            String tenantId,
                                            String redirectTo) {
        clearCookie(response, flowCookie.getName());
        String path = "/oauth/continue?tenantId=" +
                encode(tenantId, UTF_8);
        // TODO: Add redirectTo support for local debugging after the frontend removes this parameter in SaaS mode
        found(request, response, path);
    }
}
