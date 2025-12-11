package com.openframe.authz.security;

public record SsoInviteCookiePayload(
        String s,
        String invitationId,
        Boolean switchTenant,
        String provider,
        String redirectTo,
        long iat,
        long exp
) {
}

