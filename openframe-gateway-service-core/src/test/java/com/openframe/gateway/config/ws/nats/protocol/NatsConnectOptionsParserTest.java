package com.openframe.gateway.config.ws.nats.protocol;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import tools.jackson.databind.ObjectMapper;

import java.util.Optional;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

class NatsConnectOptionsParserTest {

    private NatsControlLineParser controlLineParser;
    private NatsConnectOptionsParser parser;

    @BeforeEach
    void setUp() {
        controlLineParser = new NatsControlLineParser();
        parser = new NatsConnectOptionsParser(new ObjectMapper());
    }

    @Test
    void credentialFieldOf_deviceUserWithEmptyPassword_empty() {
        // setup
        NatsControlLine connect = connect("{\"verbose\":false,\"user\":\"machine\",\"pass\":\"\"}");

        // execution
        Optional<String> credentialField = parser.credentialFieldOf(connect);

        // verifications
        assertThat(credentialField).isEmpty();
    }

    @ParameterizedTest
    @CsvSource({
            "{\"user\":\"service\"&\"pass\":\"secret\"},  pass",
            "{\"auth_token\":\"t0ken\"},                   auth_token",
            "{\"jwt\":\"eyJ\"&\"sig\":\"x\"},              jwt",
            "{\"nkey\":\"UA\"},                            nkey"
    })
    void credentialFieldOf_credentialPresent_namesTheFirstOne(String optionsWithAmpersand, String expected) {
        // setup
        String options = optionsWithAmpersand.replace('&', ',');
        NatsControlLine connect = connect(options);

        // execution
        Optional<String> credentialField = parser.credentialFieldOf(connect);

        // verifications
        assertThat(credentialField).contains(expected);
    }

    @Test
    void credentialFieldOf_passwordIsJsonNull_empty() {
        // setup
        NatsControlLine connect = connect("{\"user\":\"machine\",\"pass\":null}");

        // execution
        Optional<String> credentialField = parser.credentialFieldOf(connect);

        // verifications
        assertThat(credentialField).isEmpty();
    }

    @Test
    void credentialFieldOf_optionsNotJson_throwsProtocolException() {
        // setup
        NatsControlLine connect = connect("not-json");

        // execution
        NatsProtocolException exception = assertThrows(NatsProtocolException.class, () -> parser.credentialFieldOf(connect));

        // verifications
        assertThat(exception.getMessage()).contains("JSON");
    }

    private NatsControlLine connect(String options) {
        byte[] raw = ("CONNECT " + options + "\r\n").getBytes(UTF_8);
        return controlLineParser.parse(raw);
    }
}
