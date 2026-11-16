package com.openframe.data.config;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ClientVersionThresholdTest {

    private static final long KEY_1_6_0 = 1_000_006_000_000L;

    private final ClientVersionThreshold threshold = new ClientVersionThreshold("1.6.0");

    @Test
    void getMinSupportedKey_defaultVersion_keyOfOneSixZero() {
        // execution
        long key = threshold.getMinSupportedKey();

        // verifications
        assertThat(key).isEqualTo(KEY_1_6_0);
    }

    @ParameterizedTest
    @ValueSource(strings = {"1.6", "v1.6.0", " 1.6.0 "})
    void constructor_shortOrDecoratedVersion_sameKey(String version) {
        // execution
        ClientVersionThreshold configured = new ClientVersionThreshold(version);

        // verifications
        assertThat(configured.getMinSupportedKey()).isEqualTo(KEY_1_6_0);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " ", "latest", "0.0.0"})
    void constructor_notAVersion_failsFast(String version) {
        // execution
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> new ClientVersionThreshold(version));

        // verifications
        assertThat(ex.getMessage()).contains("openframe.devices.client.min-supported-version");
    }

    @ParameterizedTest
    @CsvSource({
            "1,                 true",
            "1000005999999,     true",
            "1000005000009,     true",
            "1000006000000,     false",
            "1000006000001,     false",
            "2000000000000,     false"
    })
    void isOutdated_keyAgainstThreshold_belowIsOutdated(long agentVersionKey, boolean expected) {
        // execution
        boolean outdated = threshold.isOutdated(agentVersionKey);

        // verifications
        assertThat(outdated).isEqualTo(expected);
    }

    @Test
    void isOutdated_unknownVersion_notOutdated() {
        // execution
        boolean outdated = threshold.isOutdated(null);

        // verifications
        assertThat(outdated).isFalse();
    }
}
