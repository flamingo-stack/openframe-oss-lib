package com.openframe.notification.push;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FcmPropertiesTest {

    private static FcmProperties configured() {
        FcmProperties properties = new FcmProperties();
        properties.setProjectId("flamingo-271f8");
        return properties;
    }

    @Test
    @DisplayName("Given the shipped defaults, when they are validated, then they fit FCM's payload limit — a default that does not fit would reject every push out of the box")
    void defaults_fit_the_payload_limit() {
        assertThatCode(() -> configured().validate()).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Given push is enabled with no project-id, when validated, then it fails — ADC carries no project, so FCM would have nowhere to send")
    void missing_project_id_is_rejected() {
        assertThatThrownBy(() -> new FcmProperties().validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("project-id must be set");
    }

    @Test
    @DisplayName("Given a negative budget, when validated, then it fails — a negative cap would silently truncate every value to empty")
    void negative_budget_is_rejected() {
        FcmProperties properties = configured();
        properties.setMaxTitleBytes(-1);

        assertThatThrownBy(properties::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("must not be negative");
    }

    @Test
    @DisplayName("Given a budget of Integer.MAX_VALUE, when validated, then it still fails — int addition would overflow negative and slip past the limit check")
    void overflowing_budget_sum_is_still_rejected() {
        FcmProperties properties = configured();
        properties.setMaxBodyBytes(Integer.MAX_VALUE);

        assertThatThrownBy(properties::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("do not fit FCM's 4096-byte limit");
    }

    @Test
    @DisplayName("Given a body budget raised on its own past the limit, when validated, then it fails with a message naming the budgets")
    void oversized_budget_is_rejected() {
        FcmProperties properties = configured();
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
