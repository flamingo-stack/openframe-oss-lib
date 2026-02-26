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
    private static String testBaseUrl;
    private static String testUserDomain;
    private static String port;
    private static boolean envLoaded = false;

    private static void loadEnv() {
        if (!envLoaded) {
            String baseUrlVar = System.getenv("TEST_BASE_URL");
            if (baseUrlVar != null && !baseUrlVar.trim().isEmpty()) {
                testBaseUrl = baseUrlVar.trim();
            } else {
                throw new RuntimeException("TEST_BASE_URL environment variable is not set");
            }

            String domainVar = System.getenv("TEST_USER_DOMAIN");
            if (domainVar != null && !domainVar.trim().isEmpty()) {
                testUserDomain = domainVar.trim();
            } else {
                throw new RuntimeException("TEST_USER_DOMAIN environment variable is not set");
            }

            String portVar = System.getenv("PORT");
            if (portVar != null && !portVar.trim().isEmpty()) {
                port = portVar.trim();
            }

            log.debug("TEST_BASE_URL: {}", testBaseUrl);
            log.debug("TEST_USER_DOMAIN: {}", testUserDomain);
            log.debug("PORT: {}", port);
            envLoaded = true;
        }
    }

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
        loadEnv();
        return "https://" + testUserDomain + "." + testBaseUrl + (port != null ? ":" + port : "") + "/";
    }

    public static String getAuthUrl() {
        loadEnv();
        return "https://" + testBaseUrl + "/";
    }

    public static String getUserDomain() {
        loadEnv();
        return testUserDomain + "." + testBaseUrl;
    }

    public static String getRegistrationUrl() {
        loadEnv();
        return "https://" + testBaseUrl + (port != null ? ":" + port : "") + "/";
    }
}
