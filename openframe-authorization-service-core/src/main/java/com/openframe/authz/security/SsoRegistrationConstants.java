package com.openframe.authz.security;

public final class SsoRegistrationConstants {
    private SsoRegistrationConstants() {
    }

    public static final String COOKIE_SSO_REG = "of_sso_reg";
    public static final String COOKIE_SSO_INVITE = "of_sso_invite";
    public static final String COOKIE_SSO_LOGIN = "of_sso_login";
    public static final String ONBOARDING_TENANT_ID = "sso-onboarding";

    /** Lifetime of every signed SSO flow cookie — long enough for a provider round-trip, no more. */
    public static final int FLOW_COOKIE_TTL_SECONDS = 600;

    /** Spring's OAuth2 authorization-start path for a provider, in the given tenant's context. */
    public static String providerAuthorizationPath(String provider, String tenantId) {
        return "/oauth2/authorization/" + provider + "?tenant=" + tenantId;
    }
}
