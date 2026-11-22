package com.openframe.authz.security;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Binds a shared or company sign-in to its callback without carrying workspace routing data.
 */
public record SsoLoginCookiePayload(
        String s,
        String provider,
        String redirectTo,
        boolean authMobile,
        long iat,
        long exp,
        @JsonInclude(JsonInclude.Include.NON_NULL) Boolean companySso
) implements SsoCookiePayload {

    public SsoLoginCookiePayload(String s, String provider, String redirectTo, boolean authMobile, long iat, long exp) {
        this(s, provider, redirectTo, authMobile, iat, exp, null);
    }
}
