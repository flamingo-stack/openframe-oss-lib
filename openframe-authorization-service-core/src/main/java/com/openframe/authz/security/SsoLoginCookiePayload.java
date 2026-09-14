package com.openframe.authz.security;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * Flow cookie for the email-less SSO login: the user picked a provider on the login page without
 * entering an email, so the tenant is unknown until the provider's callback identifies them.
 */
@Getter
@AllArgsConstructor
public class SsoLoginCookiePayload implements SsoCookiePayload {
    private final String s;
    private final String provider;
    private final String redirectTo;
    private final boolean authMobile;
    private final long iat;
    private final long exp;
}
