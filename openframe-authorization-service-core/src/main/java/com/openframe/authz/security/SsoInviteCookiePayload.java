package com.openframe.authz.security;

@lombok.Getter
@lombok.AllArgsConstructor
public class SsoInviteCookiePayload implements SsoCookiePayload {
    private final String s;
    private final String invitationId;
    private final Boolean switchTenant;
    private final String provider;
    private final String redirectTo;
    private final boolean authMobile;
    private final long iat;
    private final long exp;
}

