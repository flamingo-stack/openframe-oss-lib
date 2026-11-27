package com.openframe.gateway.config.ws.nats.protocol;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

class NatsOperationTest {

    @ParameterizedTest
    @CsvSource({
            "SUB,      SUB",
            "sub,      SUB",
            "Hpub,     HPUB",
            "CONNECT,  CONNECT",
            "INFO,     OTHER",
            "MSG,      OTHER",
            "other,    OTHER",
            "x,        OTHER"
    })
    void of_verbInAnyCase_knownOperationOrOther(String verb, NatsOperation expected) {
        // execution
        NatsOperation operation = NatsOperation.of(verb);

        // verifications
        assertThat(operation).isEqualTo(expected);
    }
}
