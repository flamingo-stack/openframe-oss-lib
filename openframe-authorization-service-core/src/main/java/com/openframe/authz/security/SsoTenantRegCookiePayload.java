package com.openframe.authz.security;

import com.openframe.authz.dto.Touchpoint;

public record SsoTenantRegCookiePayload(
        String s,
        String email,
        String tenantName,
        String tenantDomain,
        String provider,
        String redirectTo,
        boolean authMobile,
        Touchpoint attribution,
        long iat,
        long exp
) implements SsoCookiePayload {
}
