package com.openframe.authz.security;

import com.openframe.authz.dto.RegistrationAttribution;

public record SsoTenantRegCookiePayload(
        String s,
        String email,
        String tenantName,
        String tenantDomain,
        String provider,
        String redirectTo,
        boolean authMobile,
        RegistrationAttribution attribution,
        long iat,
        long exp
) implements SsoCookiePayload {
}
