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

    /**
     * Resolve [firstName, lastName] from OIDC claims.
     * Prefers the standard `given_name` / `family_name` claims (provided by Google), and falls back
     * to splitting the `name` claim when they are absent. Microsoft's id_token frequently carries only
     * `name`, so without this fallback such logins produce blank first/last names.
     * As a last resort, when no name claim is present at all, firstName falls back to the email
     * local-part (before `@`) so the user is never created with a blank first name.
     * Never returns null entries (blanks instead) so callers can persist directly.
     */
    public static String[] resolveNames(OidcUser user) {
        String givenName = stringClaim(user.getClaims().get("given_name"));
        String familyName = stringClaim(user.getClaims().get("family_name"));
        if ((givenName == null || givenName.isBlank()) && (familyName == null || familyName.isBlank())) {
            String full = user.getFullName();
            if (full != null && !full.isBlank()) {
                String[] parts = full.trim().split("\\s+", 2);
                givenName = parts[0];
                familyName = parts.length > 1 ? parts[1] : "";
            }
        }
        if (givenName == null || givenName.isBlank()) {
            givenName = emailLocalPart(user);
        }
        return new String[]{givenName != null ? givenName : "", familyName != null ? familyName : ""};
    }

    /**
     * The portion of the resolved email before `@`, or null when no email is available.
     */
    private static String emailLocalPart(OidcUser user) {
        String email = resolveEmail(user);
        if (email == null || email.isBlank()) {
            return null;
        }
        int at = email.indexOf('@');
        return at > 0 ? email.substring(0, at) : email;
    }

    /**
     * Resolve a profile picture URL from OIDC claims.
     * Standard OIDC `picture` claim is provided by Google. Microsoft does not provide it via id_token claims
     * (it requires a Microsoft Graph call to /me/photo/$value), so this returns null for Microsoft.
     */
    public static String resolvePictureUrl(OidcUser user) {
        return stringClaim(user.getClaims().get("picture"));
    }
}


