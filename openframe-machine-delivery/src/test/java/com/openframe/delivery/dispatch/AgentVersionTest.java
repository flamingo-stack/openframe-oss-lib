package com.openframe.delivery.dispatch;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

class AgentVersionTest {

    @ParameterizedTest
    @CsvSource({
            "1.4.0,    1.4.0, true",
            "1.4.1,    1.4.0, true",
            "1.10.0,   1.9.9, true",
            "1.4,      1.4.0, true",
            "1.4.0.1,  1.4.0, true",
            "v1.4.0,   1.4.0, true",
            "2.0.0,    1.4.0, true",
            "1.3.9,    1.4.0, false",
            "0.9.99,   1.0.0, false",
            "1.4,      1.4.1, false"
    })
    void isAtLeast_versionAgainstMinimum_numericSegmentsDecide(String version, String minimum, boolean expected) {
        // setup

        // execution
        boolean atLeast = AgentVersion.isAtLeast(version, minimum);

        // verifications
        assertThat(atLeast).isEqualTo(expected);
    }
}
