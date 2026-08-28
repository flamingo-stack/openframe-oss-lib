package com.openframe.test.config;

import lombok.extern.slf4j.Slf4j;

/**
 * Credentials for the External API ({@code /external-api/**}), which authenticates with a single
 * {@code X-API-Key} header instead of the OAuth session the rest of the suite runs as.
 *
 * <p>Follows the {@link UserConfig} shape: a lazy {@code System.getenv} read that fails fast, plus a
 * {@link #configure(String)} setter so the downstream runner service can inject the key programmatically
 * rather than through the environment.
 *
 * <p>The key is a two-part secret, {@code ak_<keyId>.sk_<secret>}. Only the {@code keyId} half is safe
 * to log, which is what {@link #getKeyId()} exists for — never log {@link #getApiKey()}.
 */
@Slf4j
public class ExternalApiConfig {

    private static final String API_KEY_ENV = "TEST_EXTERNAL_API_KEY";

    private static String apiKey;

    public static void configure(String key) {
        apiKey = key;
    }

    public static String getApiKey() {
        if (apiKey == null) {
            String envVar = System.getenv(API_KEY_ENV);
            if (envVar == null || envVar.trim().isEmpty()) {
                throw new RuntimeException(API_KEY_ENV + " environment variable is not set");
            }
            apiKey = envVar.trim();
            log.debug("{}: {}", API_KEY_ENV, maskedKey());
        }
        return apiKey;
    }

    /**
     * Whether a key is available, without throwing. Test classes gate on this via {@code @EnabledIf}
     * so a run with no key configured reports the External API cases as skipped rather than errored.
     */
    public static boolean hasApiKey() {
        if (apiKey != null) {
            return true;
        }
        String envVar = System.getenv(API_KEY_ENV);
        return envVar != null && !envVar.trim().isEmpty();
    }

    /** The public {@code ak_*} half of the key. Safe to log; identifies the key in gateway rate-limit buckets. */
    public static String getKeyId() {
        String key = getApiKey();
        int dot = key.indexOf('.');
        return dot > 0 ? key.substring(0, dot) : key;
    }

    /** Key with the secret half elided, for log lines. */
    public static String maskedKey() {
        return hasApiKey() ? getKeyId() + ".sk_****" : "<unset>";
    }
}
