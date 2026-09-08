package com.openframe.authz.service.sso;

/**
 * What an SSO flow init hands back to its controller: the signed flow cookie to set, and where to
 * send the browser next. Shared by tenant registration, invitation acceptance, and email-less login.
 */
public record SsoAuthorizeData(String cookieValue,
                               int cookieTtlSeconds,
                               String provider,
                               String state,
                               String redirectPath) {
}
