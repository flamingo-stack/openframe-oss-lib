package com.openframe.authz.metrics;

import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class PasswordLoginMetrics {

    private static final String SUCCEEDED_COUNTER = "openframe.auth.password_login.succeeded";
    private static final String TAG_RECAPTCHA_SESSION = "recaptcha_session";
    private static final String PRESENT = "present";
    private static final String ABSENT = "absent";

    private final MeterRegistry meterRegistry;
    private final boolean recaptchaSessionExpected;

    public PasswordLoginMetrics(MeterRegistry meterRegistry,
                                @Value("${openframe.recaptcha.session-site-key:}") String recaptchaSessionSiteKey) {
        this.meterRegistry = meterRegistry;
        this.recaptchaSessionExpected = !recaptchaSessionSiteKey.isBlank();
    }

    public void recordSucceeded(boolean recaptchaSessionPresent) {
        if (!recaptchaSessionExpected) {
            return;
        }
        String recaptchaSession = recaptchaSessionPresent ? PRESENT : ABSENT;
        meterRegistry.counter(SUCCEEDED_COUNTER, TAG_RECAPTCHA_SESSION, recaptchaSession).increment();
    }
}
