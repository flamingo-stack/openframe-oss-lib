package com.openframe.gateway.config.ws.nats.jetstream;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class JetStreamApiSubjectParserTest {

    private JetStreamApiSubjectParser parser;

    @BeforeEach
    void setUp() {
        parser = new JetStreamApiSubjectParser();
    }

    @Test
    void consumerCreateOf_filteredCreate_streamConsumerAndFilter() {
        // execution
        Optional<JetStreamApiSubject> call = parser.consumerCreateOf("$JS.API.CONSUMER.CREATE.CHAT_CHUNKS.c1.chat.d-1.message");

        // verifications
        assertThat(call).contains(new JetStreamApiSubject("CHAT_CHUNKS", Optional.of("c1"), Optional.of("chat.d-1.message")));
    }

    @Test
    void consumerCreateOf_createWithName_noFilter() {
        // execution
        Optional<JetStreamApiSubject> call = parser.consumerCreateOf("$JS.API.CONSUMER.CREATE.CHAT_CHUNKS.c1");

        // verifications
        assertThat(call).contains(new JetStreamApiSubject("CHAT_CHUNKS", Optional.of("c1"), Optional.empty()));
    }

    @Test
    void consumerCreateOf_bareCreate_streamOnly() {
        // execution
        Optional<JetStreamApiSubject> call = parser.consumerCreateOf("$JS.API.CONSUMER.CREATE.CHAT_CHUNKS");

        // verifications
        assertThat(call).contains(new JetStreamApiSubject("CHAT_CHUNKS", Optional.empty(), Optional.empty()));
    }

    @Test
    void consumerCreateOf_legacyDurableCreate_streamAndDurable() {
        // execution
        Optional<JetStreamApiSubject> call = parser.consumerCreateOf("$JS.API.CONSUMER.DURABLE.CREATE.CHAT_CHUNKS.d1");

        // verifications
        assertThat(call).contains(new JetStreamApiSubject("CHAT_CHUNKS", Optional.of("d1"), Optional.empty()));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "$JS.API.CONSUMER.INFO.CHAT_CHUNKS.c1",
            "$JS.API.CONSUMER.MSG.NEXT.CHAT_CHUNKS.c1",
            "$JS.API.STREAM.INFO.CHAT_CHUNKS",
            "machine.m-1.heartbeat"
    })
    void consumerCreateOf_otherSubject_empty(String subject) {
        // execution
        Optional<JetStreamApiSubject> call = parser.consumerCreateOf(subject);

        // verifications
        assertThat(call).isEmpty();
    }
}
