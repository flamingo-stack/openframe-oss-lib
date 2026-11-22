package com.openframe.authz.security;

public final class SsoRegistrationConstants {
    private SsoRegistrationConstants() {
    }

    public static final String ONBOARDING_TENANT_ID = "sso-onboarding";

    /**
     * HTTP-session attribute stamped with the invitation id when an SSO invite is deferred to the
     * consent page, and re-checked when the consent page finalizes — binds the completing session
     * to the invite flow it came through, so a session cannot complete a different invitation's
     * (stolen/stale) of_sso_invite cookie. Relay-safe: no dependence on the email claim.
     */
    public static final String SESSION_ATTR_JOIN_INVITE_ID = "of_sso_join_invite_id";

    /** Lifetime of every signed SSO flow cookie — long enough for a provider round-trip, no more. */
    public static final int FLOW_COOKIE_TTL_SECONDS = 600;

    /** Spring's OAuth2 authorization-start path for a provider, in the given tenant's context. */
    public static String providerAuthorizationPath(String provider, String tenantId) {
        return "/oauth2/authorization/" + provider + "?tenant=" + tenantId;
    }
}
