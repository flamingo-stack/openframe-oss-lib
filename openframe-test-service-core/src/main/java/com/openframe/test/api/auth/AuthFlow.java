package com.openframe.test.api.auth;

import com.openframe.test.data.dto.user.User;
import lombok.extern.slf4j.Slf4j;

import java.util.Map;

import static com.openframe.test.config.EnvironmentConfig.OSS;
import static com.openframe.test.config.EnvironmentConfig.getEnvMode;

@Slf4j
public class AuthFlow {

    public static Map<String, String> login(User user) {
        IAuthFlow authFlow = getEnvMode().equals(OSS) ? new AuthFlowOSS(user) : new AuthFlowSAAS(user);
        log.info("Env mode: {}", getEnvMode());
        return authFlow
                .discoverTenant()
                .startFlow()
                .initAuth()
                .postCredentials()
                .getAuthCode()
                .extractTokens();
    }
}
