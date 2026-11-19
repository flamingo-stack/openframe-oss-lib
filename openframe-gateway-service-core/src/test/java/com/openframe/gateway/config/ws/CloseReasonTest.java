package com.openframe.gateway.config.ws;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

class CloseReasonTest {

    @ParameterizedTest
    @CsvSource({
            "JWT_EXPIRY,  JWT expiry",
            "SESSION_CAP, remote session cap"
    })
    void getLabel_eachReason_readableLabel(CloseReason reason, String expectedLabel) {
        // setup

        // execution
        String label = reason.getLabel();

        // verifications
        assertThat(label).isEqualTo(expectedLabel);
    }
}
