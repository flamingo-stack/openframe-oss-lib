package com.openframe.authz.service.sso;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * What an SSO flow init hands back to its controller: the signed flow cookie to set, and where to
 * send the browser next. Shared by tenant registration and invitation acceptance.
 */
@Getter
@AllArgsConstructor
public class SsoAuthorizeData {
    private final String cookieValue;
    private final int cookieTtlSeconds;
    private final String provider;
    private final String state;
    private final String redirectPath;
}

