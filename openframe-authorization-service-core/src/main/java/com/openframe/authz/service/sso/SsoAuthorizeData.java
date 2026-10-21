package com.openframe.authz.service.sso;

// Signed flow cookie plus redirect target handed back to the controller by an SSO flow init.
public record SsoAuthorizeData(String cookieValue,
                               int cookieTtlSeconds,
                               String provider,
                               String state,
                               String redirectPath) {
}
