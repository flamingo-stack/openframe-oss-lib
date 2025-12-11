package com.openframe.authz.security;

public record SsoTenantRegCookiePayload(
        String s,
        String tenantName,
        String tenantDomain,
        String provider,
        String redirectTo,
        String accessCode,
        long iat,
        long exp
) {
}

