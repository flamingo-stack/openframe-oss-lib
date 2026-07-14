package com.openframe.notification.push;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FcmPropertiesTest {

    @Test
    @DisplayName("Given the shipped defaults, when they are validated, then they fit FCM's payload limit — a default that does not fit would reject every push out of the box")
    void defaults_fit_the_payload_limit() {
        assertThatCode(() -> new FcmProperties().validate()).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Given a body budget raised on its own past the limit, when the context starts, then it fails with a message naming the budgets — otherwise FCM rejects every push with INVALID_ARGUMENT, for every device at once, with nothing in our logs pointing at the config")
    void oversized_budget_fails_at_startup_not_silently_in_production() {
        FcmProperties properties = new FcmProperties();
        properties.setMaxBodyBytes(4000);

        assertThatThrownBy(properties::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("do not fit FCM's 4096-byte limit")
                .hasMessageContaining("body(4000)");
    }
}
