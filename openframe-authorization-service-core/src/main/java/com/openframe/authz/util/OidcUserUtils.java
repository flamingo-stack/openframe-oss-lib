package com.openframe.authz.util;

import org.springframework.security.oauth2.core.oidc.user.OidcUser;

public final class OidcUserUtils {

    private OidcUserUtils() {
    }

    /**
     * Resolve an email-like identifier from claims, falling back for AAD org accounts.
     * Order: email -> preferred_username -> upn -> unique_name
     */
    public static String resolveEmail(OidcUser user) {
        String email = user.getEmail();
        if (email != null && !email.isBlank()) return email;
        Object preferred = user.getClaims().get("preferred_username");
        if (preferred instanceof String s && !s.isBlank()) return s;
        Object upn = user.getClaims().get("upn");
        if (upn instanceof String s2 && !s2.isBlank()) return s2;
        Object uniq = user.getClaims().get("unique_name");
        if (uniq instanceof String s3 && !s3.isBlank()) return s3;
        return null;
    }

    /**
     * Returns string if non-blank, otherwise null.
     */
    public static String stringClaim(Object value) {
        return value instanceof String s && !s.isBlank() ? s : null;
    }
}


