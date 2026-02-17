package com.openframe.test.config;

import lombok.extern.slf4j.Slf4j;

@Slf4j
public class EnvironmentConfig {
    public static final String OSS = "OSS";
    public static final String DEV = "DEV";
    public static final String STAGE = "STAGE";
    public static final String PROD = "PROD";

    public static final String DEFAULT_BASE_URL = "https://localhost/";
    public static final String GRAPHQL = "api/graphql";

    private static String envMode;
    private static String baseUrl;
    private static String authUrl;

    public static String getEnvMode() {
        if (envMode == null) {
            String envVar = System.getenv("TEST_ENV_MODE");
            if (envVar != null && !envVar.trim().isEmpty()) {
                envMode = envVar;
            } else {
                envMode = OSS;
            }
            log.debug("TEST_ENV_MODE: {}", envMode);
        }
        return envMode;
    }

    public static String getBaseUrl() {
        if (baseUrl == null) {
            String envVar = System.getenv("API_BASE_URL");
            if (envVar != null && !envVar.trim().isEmpty()) {
                baseUrl = envVar.endsWith("/") ? envVar : envVar.concat("/");
            } else {
                throw new RuntimeException("API_BASE_URL environment variable is not set");
            }
            log.debug("API_BASE_URL: {}", baseUrl);
        }
        return baseUrl;
    }

    public static String getAuthUrl() {
        if (authUrl == null) {
            String envVar = System.getenv("API_AUTH_URL");
            if (envVar != null && !envVar.trim().isEmpty()) {
                authUrl = envVar.endsWith("/") ? envVar : envVar.concat("/");
            } else {
                throw new RuntimeException("API_AUTH_URL environment variable is not set");
            }
            log.debug("API_AUTH_URL: {}", authUrl);
        }
        return authUrl;
    }
}
