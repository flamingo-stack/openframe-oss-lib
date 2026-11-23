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
        assertThat(call).contains(JetStreamApiSubject.builder().stream("CHAT_CHUNKS").consumerName("c1").filterSubject("chat.d-1.message").build());
    }

    @Test
    void consumerCreateOf_createWithName_noFilter() {
        // execution
        Optional<JetStreamApiSubject> call = parser.consumerCreateOf("$JS.API.CONSUMER.CREATE.CHAT_CHUNKS.c1");

        // verifications
        assertThat(call).contains(JetStreamApiSubject.builder().stream("CHAT_CHUNKS").consumerName("c1").build());
    }

    @Test
    void consumerCreateOf_bareCreate_streamOnly() {
        // execution
        Optional<JetStreamApiSubject> call = parser.consumerCreateOf("$JS.API.CONSUMER.CREATE.CHAT_CHUNKS");

        // verifications
        assertThat(call).contains(JetStreamApiSubject.builder().stream("CHAT_CHUNKS").build());
    }

    @Test
    void consumerCreateOf_legacyDurableCreate_streamAndDurable() {
        // execution
        Optional<JetStreamApiSubject> call = parser.consumerCreateOf("$JS.API.CONSUMER.DURABLE.CREATE.CHAT_CHUNKS.d1");

        // verifications
        assertThat(call).contains(JetStreamApiSubject.builder().stream("CHAT_CHUNKS").consumerName("d1").build());
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

    @ParameterizedTest
    @ValueSource(strings = {
            "$JS.API.CONSUMER.INFO.CHAT_CHUNKS.c1",
            "$JS.API.CONSUMER.DELETE.CHAT_CHUNKS.c1",
            "$JS.API.CONSUMER.MSG.NEXT.CHAT_CHUNKS.c1"
    })
    void consumerAccessOf_callOnAnExistingConsumer_streamAndName(String subject) {
        // execution
        Optional<JetStreamConsumerAccess> access = parser.consumerAccessOf(subject);

        // verifications
        assertThat(access).contains(new JetStreamConsumerAccess("CHAT_CHUNKS", "c1"));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "$JS.API.CONSUMER.CREATE.CHAT_CHUNKS.c1.chat.d-1.message",
            "$JS.API.CONSUMER.INFO.CHAT_CHUNKS",
            "$JS.API.CONSUMER.INFO.CHAT_CHUNKS.c1.extra",
            "$JS.API.STREAM.INFO.CHAT_CHUNKS",
            "machine.m-1.heartbeat"
    })
    void consumerAccessOf_otherSubject_empty(String subject) {
        // execution
        Optional<JetStreamConsumerAccess> access = parser.consumerAccessOf(subject);

        // verifications
        assertThat(access).isEmpty();
    }
}
