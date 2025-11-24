package com.openframe.authz.service.sso;

public interface DefaultProviderConfig {

    String providerId();

    String getDefaultClientId();

    String getDefaultClientSecret();
}


