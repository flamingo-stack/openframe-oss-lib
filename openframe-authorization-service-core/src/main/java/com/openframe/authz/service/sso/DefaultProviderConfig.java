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
}


