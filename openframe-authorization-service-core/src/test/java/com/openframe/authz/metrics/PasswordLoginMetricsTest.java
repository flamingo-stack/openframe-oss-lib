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
        String recaptchaSession = metrics.recordSucceeded(true);

        // verifications
        assertThat(recaptchaSession).isEqualTo("present");
        assertThat(registry.get(SUCCEEDED_COUNTER).tag(TAG_RECAPTCHA_SESSION, "present").counter().count()).isEqualTo(1.0);
        assertThat(registry.find(SUCCEEDED_COUNTER).tag(TAG_RECAPTCHA_SESSION, "absent").counter()).isNull();
    }

    @Test
    void recordSucceeded_cookieAbsent_absentCounted() {
        // setup
        PasswordLoginMetrics metrics = new PasswordLoginMetrics(registry, SESSION_SITE_KEY);

        // execution
        metrics.recordSucceeded(false);
        String recaptchaSession = metrics.recordSucceeded(false);

        // verifications
        assertThat(recaptchaSession).isEqualTo("absent");
        assertThat(registry.get(SUCCEEDED_COUNTER).tag(TAG_RECAPTCHA_SESSION, "absent").counter().count()).isEqualTo(2.0);
        assertThat(registry.find(SUCCEEDED_COUNTER).tag(TAG_RECAPTCHA_SESSION, "present").counter()).isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " "})
    void recordSucceeded_sessionKeyBlank_nothingCounted(String sessionSiteKey) {
        // setup
        PasswordLoginMetrics metrics = new PasswordLoginMetrics(registry, sessionSiteKey);

        // execution
        String withCookie = metrics.recordSucceeded(true);
        String withoutCookie = metrics.recordSucceeded(false);

        // verifications
        assertThat(withCookie).isEqualTo("not_expected");
        assertThat(withoutCookie).isEqualTo("not_expected");
        assertThat(registry.find(SUCCEEDED_COUNTER).counter()).isNull();
    }
}
