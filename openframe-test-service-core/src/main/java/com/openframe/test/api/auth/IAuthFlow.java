package com.openframe.test.api.auth;

import java.util.Map;

public interface IAuthFlow {
    IAuthFlow discoverTenant();

    IAuthFlow startFlow();

    IAuthFlow initAuth();

    IAuthFlow postCredentials();

    IAuthFlow getAuthCode();

    Map<String, String> extractTokens();
}
