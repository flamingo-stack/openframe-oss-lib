package com.openframe.authz.service.sso;

public interface DefaultProviderConfig {

    String providerId();

    String getDefaultClientId();

    String getDefaultClientSecret();

    /** Apple only: Developer Team ID for the client-secret JWT. */
    default String getDefaultTeamId() {
        return null;
    }

    /** Apple only: Key ID of the .p8 signing key. */
    default String getDefaultKeyId() {
        return null;
    }

    /**
     * Whether enough defaults are present to actually complete a login. Gates the provider out of
     * signup/login lists when misconfigured, instead of showing a button that fails at the
     * client-registration step.
     */
    default boolean isConfigured() {
        return notBlank(getDefaultClientId()) && notBlank(getDefaultClientSecret());
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}


