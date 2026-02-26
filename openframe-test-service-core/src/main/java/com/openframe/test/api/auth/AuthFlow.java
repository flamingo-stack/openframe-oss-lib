package com.openframe.test.api.auth;

import com.openframe.test.data.dto.user.User;

import java.util.Map;

import static com.openframe.test.config.EnvironmentConfig.OSS;
import static com.openframe.test.config.EnvironmentConfig.getEnvMode;

public class AuthFlow {

    public static Map<String, String> login(User user) {
        IAuthFlow authFlow = getEnvMode().equals(OSS) ? new AuthFlowOSS(user) : new AuthFlowSAAS(user);
        return authFlow
                .discoverTenant()
                .startFlow()
                .initAuth()
                .postCredentials()
                .getAuthCode()
                .extractTokens();
    }
}
