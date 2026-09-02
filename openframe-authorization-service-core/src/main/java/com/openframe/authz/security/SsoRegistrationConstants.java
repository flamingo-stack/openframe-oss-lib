package com.openframe.authz.security;

public final class SsoRegistrationConstants {
    private SsoRegistrationConstants() {
    }

    public static final String COOKIE_SSO_REG = "of_sso_reg";
    public static final String COOKIE_SSO_INVITE = "of_sso_invite";
    public static final String COOKIE_SSO_LOGIN = "of_sso_login";

    /**
     * Every signed SSO flow cookie. Iterated wherever a behavior must apply to all flows —
     * sibling-cookie clearing, and the resolver's state injection (a flow whose state is not
     * injected dead-ends its callbacks in the state-mismatch guard). A new flow cookie only
     * needs to be added here.
     */
    public static final java.util.List<String> SSO_FLOW_COOKIES =
            java.util.List.of(COOKIE_SSO_REG, COOKIE_SSO_INVITE, COOKIE_SSO_LOGIN);

    public static final String ONBOARDING_TENANT_ID = "sso-onboarding";

    /** Lifetime of every signed SSO flow cookie — long enough for a provider round-trip, no more. */
    public static final int FLOW_COOKIE_TTL_SECONDS = 600;

    /** Spring's OAuth2 authorization-start path for a provider, in the given tenant's context. */
    public static String providerAuthorizationPath(String provider, String tenantId) {
        return "/oauth2/authorization/" + provider + "?tenant=" + tenantId;
    }
}
