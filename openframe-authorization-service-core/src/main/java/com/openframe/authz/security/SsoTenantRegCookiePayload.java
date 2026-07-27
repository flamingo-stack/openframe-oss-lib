package com.openframe.authz.security;

import com.openframe.authz.dto.RegistrationAttribution;

public record SsoTenantRegCookiePayload(
        String s,
        String tenantName,
        String tenantDomain,
        String provider,
        String redirectTo,
        String accessCode,
        RegistrationAttribution attribution,
        long iat,
        long exp
) {
}
