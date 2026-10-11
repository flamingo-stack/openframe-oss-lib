package com.openframe.authz.util;

import org.springframework.security.oauth2.core.oidc.user.OidcUser;

import java.util.Map;
import java.util.Optional;

public final class OidcUserUtils {

    private OidcUserUtils() {
    }

    // Order: email -> preferred_username -> upn -> unique_name, to support AAD org accounts
    public static Optional<String> resolveEmail(OidcUser user) {
        String email = user.getEmail();
        if (email != null && !email.isBlank()) return Optional.of(email);
        Object preferred = user.getClaims().get("preferred_username");
        if (preferred instanceof String s && !s.isBlank()) return Optional.of(s);
        Object upn = user.getClaims().get("upn");
        if (upn instanceof String s2 && !s2.isBlank()) return Optional.of(s2);
        Object uniq = user.getClaims().get("unique_name");
        if (uniq instanceof String s3 && !s3.isBlank()) return Optional.of(s3);
        return Optional.empty();
    }

    /**
     * One-line description of the trust-relevant Microsoft claims, for gate rejection logs:
     * which signals were present and what they said — never the email itself.
     */
    public static String describeEmailTrustSignals(Map<String, Object> claims) {
        Object edov = claims.get("xms_edov");
        Object verified = claims.get("email_verified");
        return "tid=" + claims.get("tid")
                + " xms_edov=" + (edov == null ? "absent" : edov)
                + " email_verified=" + (verified == null ? "absent" : verified);
    }

    public static boolean emailVerifiedClaimAllows(OidcUser user) {
        return emailVerifiedClaimAllows(user.getClaims());
    }

    /** Claims-map variant for callers outside the OIDC-login flow (e.g. the native Apple exchange). */
    public static boolean emailVerifiedClaimAllows(Map<String, Object> claims) {
        Object claim = claims.get("email_verified");
        if (claim instanceof Boolean b) {
            return b;
        }
        if (claim instanceof String s) {
            return !"false".equalsIgnoreCase(s);
        }
        return true;
    }

    public static Optional<String> stringClaim(Object value) {
        return value instanceof String s && !s.isBlank() ? Optional.of(s) : Optional.empty();
    }

    // Falls back to splitting `name` (Microsoft only sends this), then to the email local-part, so first name is never blank
    public static String[] resolveNames(OidcUser user) {
        String givenName = stringClaim(user.getClaims().get("given_name")).orElse(null);
        String familyName = stringClaim(user.getClaims().get("family_name")).orElse(null);
        if ((givenName == null || givenName.isBlank()) && (familyName == null || familyName.isBlank())) {
            String full = user.getFullName();
            if (full != null && !full.isBlank()) {
                String[] parts = full.trim().split("\\s+", 2);
                givenName = parts[0];
                familyName = parts.length > 1 ? parts[1] : "";
            }
        }
        if (givenName == null || givenName.isBlank()) {
            givenName = emailLocalPart(user).orElse(null);
        }
        return new String[]{givenName != null ? givenName : "", familyName != null ? familyName : ""};
    }

    private static Optional<String> emailLocalPart(OidcUser user) {
        Optional<String> email = resolveEmail(user);
        if (email.isEmpty() || email.get().isBlank()) {
            return Optional.empty();
        }
        String e = email.get();
        int at = e.indexOf('@');
        return Optional.of(at > 0 ? e.substring(0, at) : e);
    }

    // Microsoft does not expose `picture` via id_token claims (requires a Graph call), so this is empty for Microsoft
    public static Optional<String> resolvePictureUrl(OidcUser user) {
        return stringClaim(user.getClaims().get("picture"));
    }
}


