package com.openframe.gateway.config.ws.nats.jetstream;

import com.openframe.gateway.config.ws.nats.protocol.NatsProtocolException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.util.Optional;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ConsumerCreateRequestParserTest {

    private static final JetStreamApiSubject BARE_CREATE =
            new JetStreamApiSubject("CHAT_CHUNKS", Optional.empty(), Optional.empty());
    private static final JetStreamApiSubject FILTERED_CREATE =
            new JetStreamApiSubject("CHAT_CHUNKS", Optional.of("c1"), Optional.of("chat.d-1.message"));

    private ConsumerCreateRequestParser parser;

    @BeforeEach
    void setUp() {
        parser = new ConsumerCreateRequestParser(new ObjectMapper());
    }

    @Test
    void parse_filterSubjectInTheBody_singleFilter() {
        // setup
        byte[] body = json("{\"stream_name\":\"CHAT_CHUNKS\",\"config\":{\"filter_subject\":\"chat.d-1.message\",\"deliver_policy\":\"new\"}}");

        // execution
        ConsumerCreateRequest request = parser.parse(BARE_CREATE, body);

        // verifications
        assertThat(request.stream()).isEqualTo("CHAT_CHUNKS");
        assertThat(request.filterSubjects()).containsExactly("chat.d-1.message");
        assertThat(request.deliverSubject()).isEmpty();
        assertThat(request.isUnfiltered()).isFalse();
    }

    @Test
    void parse_filterSubjectsArrayInTheBody_allFilters() {
        // setup
        byte[] body = json("{\"config\":{\"filter_subjects\":[\"chat.d-1.message\",\"chat.d-2.message\"]}}");

        // execution
        ConsumerCreateRequest request = parser.parse(BARE_CREATE, body);

        // verifications
        assertThat(request.filterSubjects()).containsExactly("chat.d-1.message", "chat.d-2.message");
    }

    @Test
    void parse_filterOnlyInTheApiSubject_takenFromThere() {
        // setup
        byte[] body = json("{\"config\":{\"deliver_policy\":\"new\"}}");

        // execution
        ConsumerCreateRequest request = parser.parse(FILTERED_CREATE, body);

        // verifications
        assertThat(request.filterSubjects()).containsExactly("chat.d-1.message");
    }

    @Test
    void parse_noFilterAnywhere_unfiltered() {
        // setup
        byte[] body = json("{\"config\":{\"deliver_policy\":\"all\"}}");

        // execution
        ConsumerCreateRequest request = parser.parse(BARE_CREATE, body);

        // verifications
        assertThat(request.isUnfiltered()).isTrue();
    }

    @Test
    void parse_streamNameMissingInTheBody_takenFromTheApiSubject() {
        // setup
        byte[] body = json("{\"config\":{\"filter_subject\":\"chat.d-1.message\"}}");

        // execution
        ConsumerCreateRequest request = parser.parse(BARE_CREATE, body);

        // verifications
        assertThat(request.stream()).isEqualTo("CHAT_CHUNKS");
    }

    @Test
    void parse_pushConsumer_deliverSubjectRead() {
        // setup
        byte[] body = json("{\"config\":{\"filter_subject\":\"chat.d-1.message\",\"deliver_subject\":\"_INBOX.abc\"}}");

        // execution
        ConsumerCreateRequest request = parser.parse(BARE_CREATE, body);

        // verifications
        assertThat(request.deliverSubject()).contains("_INBOX.abc");
    }

    @Test
    void parse_bodyNotJson_throwsProtocolException() {
        // setup
        byte[] body = "not-json".getBytes(UTF_8);

        // execution
        NatsProtocolException exception = assertThrows(NatsProtocolException.class, () -> parser.parse(BARE_CREATE, body));

        // verifications
        assertThat(exception.getMessage()).contains("JSON");
    }

    private static byte[] json(String text) {
        return text.getBytes(UTF_8);
    }
}
