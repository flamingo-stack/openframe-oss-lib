package com.openframe.authz.security;

/**
 * Flow cookie for the email-less SSO login: the user picked a provider on the login page without
 * entering an email, so the tenant is unknown until the provider's callback identifies them.
 */
public record SsoLoginCookiePayload(
        String s,
        String provider,
        String redirectTo,
        boolean authMobile,
        long iat,
        long exp
) implements SsoCookiePayload {
}
