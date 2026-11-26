package com.openframe.authz.metrics;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class PasswordLoginMetricsTest {

    private static final String SUCCEEDED_COUNTER = "openframe.auth.password_login.succeeded";
    private static final String TAG_RECAPTCHA_SESSION = "recaptcha_session";
    private static final String SESSION_SITE_KEY = "6LcSessionSiteKey";

    private final SimpleMeterRegistry registry = new SimpleMeterRegistry();

    @Test
    void recordSucceeded_cookiePresent_presentCounted() {
        // setup
        PasswordLoginMetrics metrics = new PasswordLoginMetrics(registry, SESSION_SITE_KEY);

        // execution
        metrics.recordSucceeded(true);

        // verifications
        assertThat(registry.get(SUCCEEDED_COUNTER).tag(TAG_RECAPTCHA_SESSION, "present").counter().count()).isEqualTo(1.0);
        assertThat(registry.find(SUCCEEDED_COUNTER).tag(TAG_RECAPTCHA_SESSION, "absent").counter()).isNull();
    }

    @Test
    void recordSucceeded_cookieAbsent_absentCounted() {
        // setup
        PasswordLoginMetrics metrics = new PasswordLoginMetrics(registry, SESSION_SITE_KEY);

        // execution
        metrics.recordSucceeded(false);
        metrics.recordSucceeded(false);

        // verifications
        assertThat(registry.get(SUCCEEDED_COUNTER).tag(TAG_RECAPTCHA_SESSION, "absent").counter().count()).isEqualTo(2.0);
        assertThat(registry.find(SUCCEEDED_COUNTER).tag(TAG_RECAPTCHA_SESSION, "present").counter()).isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " "})
    void recordSucceeded_sessionKeyBlank_nothingCounted(String sessionSiteKey) {
        // setup
        PasswordLoginMetrics metrics = new PasswordLoginMetrics(registry, sessionSiteKey);

        // execution
        metrics.recordSucceeded(true);
        metrics.recordSucceeded(false);

        // verifications
        assertThat(registry.find(SUCCEEDED_COUNTER).counter()).isNull();
    }
}
