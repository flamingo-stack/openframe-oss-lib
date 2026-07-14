package com.openframe.notification.push;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FcmPropertiesTest {

    @Test
    @DisplayName("Given the shipped defaults, when they are validated, then they fit FCM's payload limit — a default that does not fit would reject every push out of the box")
    void defaults_fit_the_payload_limit() {
        assertThatCode(() -> new FcmProperties().validate()).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Given a body budget raised on its own past the limit, when validated, then it fails with a message naming the budgets")
    void oversized_budget_is_rejected() {
        FcmProperties properties = new FcmProperties();
        properties.setMaxBodyBytes(4000);

        assertThatThrownBy(properties::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("do not fit FCM's 4096-byte limit")
                .hasMessageContaining("body(4000)");
    }

    @Test
    @DisplayName("Given budgets that do not fit, when a real Spring context starts, then the context FAILS — proving the check is wired to the bean lifecycle and fires at deploy time, not on the first push under load")
    void spring_fails_the_context_at_startup_rather_than_on_the_first_push() {
        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(PushAutoConfiguration.class))
                .withPropertyValues(
                        "openframe.features.push.enabled=true",
                        "openframe.push.fcm.project-id=flamingo-271f8",
                        "openframe.push.fcm.max-body-bytes=4000")
                .run(context -> assertThat(context)
                        .hasFailed()
                        .getFailure()
                        .hasMessageContaining("do not fit FCM's 4096-byte limit"));
    }
}
