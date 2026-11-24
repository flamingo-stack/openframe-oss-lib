package com.openframe.gateway.config.ws.nats.protocol;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

class NatsControlLineParserTest {

    private NatsControlLineParser parser;

    @BeforeEach
    void setUp() {
        parser = new NatsControlLineParser();
    }

    @Test
    void parse_subscribe_operationSubjectAndNoPayload() {
        // setup
        byte[] raw = "SUB machine.m-1.command-execution 1\r\n".getBytes(UTF_8);

        // execution
        NatsControlLine line = parser.parse(raw);

        // verifications
        assertThat(line.getOperation()).isEqualTo(NatsOperation.SUB);
        assertThat(line.getSubject()).contains("machine.m-1.command-execution");
        assertThat(line.hasPayload()).isFalse();
        assertThat(line.getRaw()).isEqualTo(raw);
    }

    @Test
    void parse_subscribeWithQueueGroup_subjectIsTheSecondToken() {
        // setup
        byte[] raw = "SUB machine.m-1.command-execution workers 7\r\n".getBytes(UTF_8);

        // execution
        NatsControlLine line = parser.parse(raw);

        // verifications
        assertThat(line.getSubject()).contains("machine.m-1.command-execution");
    }

    @Test
    void parse_publishWithReplySubject_sizeTakenFromTheLastToken() {
        // setup
        byte[] raw = "PUB machine.m-1.hostname _INBOX.abc.1 12\r\n".getBytes(UTF_8);

        // execution
        NatsControlLine line = parser.parse(raw);

        // verifications
        assertThat(line.getOperation()).isEqualTo(NatsOperation.PUB);
        assertThat(line.getSubject()).contains("machine.m-1.hostname");
        assertThat(line.getPayloadSize()).isEqualTo(12);
    }

    @Test
    void parse_publishWithReplySubject_replySubjectRead() {
        // setup
        byte[] raw = "PUB machine.m-1.hostname _INBOX.abc.1 12\r\n".getBytes(UTF_8);

        // execution
        NatsControlLine line = parser.parse(raw);

        // verifications
        assertThat(line.getReplySubject()).contains("_INBOX.abc.1");
    }

    @Test
    void parse_headerPublishWithReplySubject_replySubjectRead() {
        // setup
        byte[] raw = "HPUB machine.m-1.hostname _INBOX.abc.1 12 17\r\n".getBytes(UTF_8);

        // execution
        NatsControlLine line = parser.parse(raw);

        // verifications
        assertThat(line.getReplySubject()).contains("_INBOX.abc.1");
    }

    @Test
    void parse_publishWithoutReplySubject_noReplySubject() {
        // setup
        byte[] raw = "PUB machine.m-1.hostname 12\r\n".getBytes(UTF_8);

        // execution
        NatsControlLine line = parser.parse(raw);

        // verifications
        assertThat(line.getReplySubject()).isEmpty();
    }

    @Test
    void parse_headerPublish_sizeIsTheTotal() {
        // setup
        byte[] raw = "HPUB machine.m-1.hostname 12 17\r\n".getBytes(UTF_8);

        // execution
        NatsControlLine line = parser.parse(raw);

        // verifications
        assertThat(line.getOperation()).isEqualTo(NatsOperation.HPUB);
        assertThat(line.getPayloadSize()).isEqualTo(17);
    }

    @Test
    void parse_connect_argumentsAreTheJsonOptions() {
        // setup
        byte[] raw = "CONNECT {\"user\":\"machine\",\"pass\":\"\"}\r\n".getBytes(UTF_8);

        // execution
        NatsControlLine line = parser.parse(raw);

        // verifications
        assertThat(line.getOperation()).isEqualTo(NatsOperation.CONNECT);
        assertThat(line.getArguments()).isEqualTo("{\"user\":\"machine\",\"pass\":\"\"}");
        assertThat(line.getSubject()).isEmpty();
    }

    @ParameterizedTest
    @CsvSource({
            "sub machine.m-1.x 1,   SUB",
            "Pub machine.m-1.x 0,   PUB",
            "PING,                  PING",
            "PONG,                  PONG",
            "UNSUB 1,               UNSUB",
            "INFO {},               OTHER"
    })
    void parse_verbInAnyCase_recognised(String line, NatsOperation expected) {
        // setup
        byte[] raw = (line + "\r\n").getBytes(UTF_8);

        // execution
        NatsControlLine parsed = parser.parse(raw);

        // verifications
        assertThat(parsed.getOperation()).isEqualTo(expected);
    }

    @Test
    void parse_bareNewline_parsedAllTheSame() {
        // setup
        byte[] raw = "SUB machine.m-1.x 1\n".getBytes(UTF_8);

        // execution
        NatsControlLine line = parser.parse(raw);

        // verifications
        assertThat(line.getSubject()).contains("machine.m-1.x");
    }

    @Test
    void parse_emptyLine_other() {
        // setup
        byte[] raw = "\r\n".getBytes(UTF_8);

        // execution
        NatsControlLine line = parser.parse(raw);

        // verifications
        assertThat(line.getOperation()).isEqualTo(NatsOperation.OTHER);
    }

    @Test
    void parse_subscribeWithoutSid_throwsProtocolException() {
        // setup
        byte[] raw = "SUB machine.m-1.x\r\n".getBytes(UTF_8);

        // execution
        NatsProtocolException exception = assertThrows(NatsProtocolException.class, () -> parser.parse(raw));

        // verifications
        assertThat(exception.getMessage()).contains("too few arguments");
    }

    @Test
    void parse_publishSizeNotANumber_throwsProtocolException() {
        // setup
        byte[] raw = "PUB machine.m-1.x abc\r\n".getBytes(UTF_8);

        // execution
        NatsProtocolException exception = assertThrows(NatsProtocolException.class, () -> parser.parse(raw));

        // verifications
        assertThat(exception.getMessage()).contains("payload size");
    }
}
