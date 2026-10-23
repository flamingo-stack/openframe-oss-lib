package com.openframe.test.helpers;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pins the default. Response logging costs about 4.5x the volume, so "off unless asked" is the
 * behaviour, not an accident — an inverted default would quietly fill the appender on every pipeline
 * run and roll away the start of it.
 */
class RequestSpecHelperLogResponsesTest {

    @AfterEach
    void reset() {
        RequestSpecHelper.setLogResponses(false);
    }

    @Test
    @DisplayName("Off unless something asks for it")
    void offByDefault() {
        assertThat(RequestSpecHelper.logResponses())
                .as("An unconfigured run must not pay for response bodies").isFalse();
    }

    @Test
    @DisplayName("An explicit setting wins")
    void explicitWins() {
        RequestSpecHelper.setLogResponses(true);

        assertThat(RequestSpecHelper.logResponses()).isTrue();
    }
}
