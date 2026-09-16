package com.openframe.authz.util;

import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;

import java.util.Optional;

/**
 * Reads the two things every SSO callback consumer pulls off the authenticated principal: the
 * {@link OidcUser} and the provider registration id. One place so the {@code instanceof
 * OAuth2AuthenticationToken} dance isn't re-typed at every call site.
 */
public final class SsoAuthentication {

    private SsoAuthentication() {
    }

    public static Optional<OidcUser> oidcUser(Authentication authentication) {
        return authentication instanceof OAuth2AuthenticationToken token
                && token.getPrincipal() instanceof OidcUser user
                ? Optional.of(user) : Optional.empty();
    }

    /** The provider the principal authenticated with ({@code google}/{@code microsoft}/{@code apple}), or {@code null}. */
    public static String registrationId(Authentication authentication) {
        return authentication instanceof OAuth2AuthenticationToken token
                ? token.getAuthorizedClientRegistrationId() : null;
    }
}
