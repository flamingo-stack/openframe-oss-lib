package com.openframe.authz.security.flow;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;

import com.openframe.authz.util.AppleUserParam;
import com.openframe.authz.util.OidcUserUtils;

import java.util.Optional;

import static com.openframe.authz.util.OidcUserUtils.resolveEmail;
import static com.openframe.authz.web.AuthStateUtils.clearCookie;
import static com.openframe.authz.web.Redirects.foundAtRoot;
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
        if (c == null) throw new IllegalStateException("SSO session expired. Please try again.");
        return c;
    }

    default boolean isActivated(HttpServletRequest request) {
        return resolveCookie(request) != null;
    }

    /**
     * State this flow put into its own cookie, or empty if the cookie is absent, tampered with or expired.
     */
    Optional<String> expectedState(Cookie cookie);

    /**
     * Whether this flow owns the callback, decided by the state the provider echoed back rather than by
     * cookie presence. Both flows may have left a cookie behind, so presence alone picks the wrong handler.
     */
    default boolean matchesState(HttpServletRequest request, String returnedState) {
        if (returnedState == null || returnedState.isBlank()) return false;
        Cookie cookie = resolveCookie(request);
        if (cookie == null) return false;
        return expectedState(cookie).filter(returnedState::equals).isPresent();
    }

    void handle(HttpServletRequest request, HttpServletResponse response, Authentication authentication) throws Exception;

    default OidcUser requireOidcUser(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof OidcUser u) return u;
        throw new IllegalStateException("Unexpected authentication type. Please use SSO login.");
    }

    default String requireEmail(OidcUser u) {
        String email = resolveEmail(u);
        if (email == null || email.isBlank()) throw new IllegalStateException("Email not provided by SSO provider. Please use an account with a verified email.");
        return email.toLowerCase(ROOT);
    }

    default String[] resolveNames(OidcUser oidcUser) {
        return OidcUserUtils.resolveNames(oidcUser);
    }

    /**
     * Token names first; when the token has none (Apple's never does), falls back to the
     * {@code user} form parameter Apple posts on the first-ever callback only. The fallback is
     * gated on the authenticated provider actually being Apple — the parameter is untrusted
     * request input and must not feed names into other providers' callbacks.
     */
    default String[] resolveNames(HttpServletRequest request, Authentication authentication, OidcUser oidcUser) {
        String registrationId = authentication instanceof OAuth2AuthenticationToken token
                ? token.getAuthorizedClientRegistrationId()
                : null;
        return AppleUserParam.namesOrAppleFallback(OidcUserUtils.resolveNames(oidcUser), registrationId, request);
    }

    default void clearFlowCookieAndRedirect(HttpServletResponse response,
                                            Cookie flowCookie,
                                            String tenantId,
                                            String redirectTo) {
        clearCookie(response, flowCookie.getName());
        String path = "/oauth/continue?tenantId=" +
                encode(tenantId, UTF_8);
        if (redirectTo != null && !redirectTo.isBlank()) {
            path += "&redirectTo=" + encode(redirectTo, UTF_8);
        }
        foundAtRoot(response, path);
    }
}
