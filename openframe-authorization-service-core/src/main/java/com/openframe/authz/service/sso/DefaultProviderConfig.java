package com.openframe.authz.service.sso;

public interface DefaultProviderConfig {

    String providerId();

    String getDefaultClientId();

    String getDefaultClientSecret();

    // Apple only: Developer Team ID for the client-secret JWT.
    default String getDefaultTeamId() {
        return null;
    }

    // Apple only: Key ID of the .p8 signing key.
    default String getDefaultKeyId() {
        return null;
    }

    // Gates a misconfigured provider out of signup/login lists instead of failing at client registration.
    default boolean isConfigured() {
        return notBlank(getDefaultClientId()) && notBlank(getDefaultClientSecret());
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}


