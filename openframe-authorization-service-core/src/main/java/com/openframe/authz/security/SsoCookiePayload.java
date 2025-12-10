package com.openframe.authz.security;

public record SsoCookiePayload(
        String s,
        String tenantName,
        String tenantDomain,
        String provider,
        long iat,
        long exp
) {
}

