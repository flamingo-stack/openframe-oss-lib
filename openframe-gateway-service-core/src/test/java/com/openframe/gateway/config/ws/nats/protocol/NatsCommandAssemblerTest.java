package com.openframe.gateway.config.ws.nats.protocol;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

class NatsCommandAssemblerTest {

    private static final long MAX_PAYLOAD_BYTES = 1024;
    private static final String SUBSCRIBE = "SUB machine.m-1.command-execution 1\r\n";
    private static final String PING = "PING\r\n";
    private static final int OVERLONG_LINE_BYTES = NatsCommandAssembler.MAX_CONTROL_LINE_BYTES + 1;

    private NatsCommandAssembler assembler;

    @BeforeEach
    void setUp() {
        assembler = new NatsCommandAssembler(new NatsControlLineParser(), MAX_PAYLOAD_BYTES);
    }

    @Test
    void feed_severalCommandsInOneFrame_oneCommandEach() {
        // execution
        List<NatsClientCommand> commands = feed(PING + SUBSCRIBE);

        // verifications
        assertThat(commands)
                .extracting(NatsClientCommand::operation, command -> text(command.raw()))
                .containsExactly(tuple(NatsOperation.PING, PING), tuple(NatsOperation.SUB, SUBSCRIBE));
    }

    @Test
    void feed_commandSplitAcrossFrames_heldBackUntilComplete() {
        // execution
        List<NatsClientCommand> head = feed("SUB machine.m-");
        List<NatsClientCommand> tail = feed("1.command-execution 1\r\n" + PING);

        // verifications
        assertThat(head).isEmpty();
        assertThat(tail)
                .extracting(command -> text(command.raw()))
                .containsExactly(SUBSCRIBE, PING);
    }

    @Test
    void feed_publish_controlLineAndPayloadInOneCommand() {
        // setup
        String publish = "PUB machine.m-1.heartbeat 2\r\nhi\r\n";

        // execution
        List<NatsClientCommand> commands = feed(publish + PING);

        // verifications
        assertThat(commands)
                .extracting(NatsClientCommand::operation, command -> text(command.raw()), command -> text(command.payload()))
                .containsExactly(tuple(NatsOperation.PUB, publish, "hi"), tuple(NatsOperation.PING, PING, ""));
    }

    @Test
    void feed_payloadThatLooksLikeACommand_keptAsPayload() {
        // setup
        String payload = SUBSCRIBE;
        String publish = "PUB machine.m-1.heartbeat " + payload.length() + "\r\n" + payload + "\r\n";

        // execution
        List<NatsClientCommand> commands = feed(publish);

        // verifications
        assertThat(commands)
                .extracting(NatsClientCommand::operation, command -> text(command.payload()))
                .containsExactly(tuple(NatsOperation.PUB, SUBSCRIBE));
    }

    @Test
    void feed_payloadSplitAcrossFrames_commandCompletesWithTheLastByte() {
        // execution
        List<NatsClientCommand> head = feed("PUB machine.m-1.heartbeat 5\r\nab");
        List<NatsClientCommand> tail = feed("cde\r\n" + PING);

        // verifications
        assertThat(head).isEmpty();
        assertThat(tail)
                .extracting(NatsClientCommand::operation, command -> text(command.payload()))
                .containsExactly(tuple(NatsOperation.PUB, "abcde"), tuple(NatsOperation.PING, ""));
    }

    @Test
    void feed_emptyPayload_commandCompletesAfterTheTrailer() {
        // setup
        String publish = "PUB machine.m-1.heartbeat 0\r\n\r\n";

        // execution
        List<NatsClientCommand> commands = feed(publish + PING);

        // verifications
        assertThat(commands)
                .extracting(command -> text(command.raw()))
                .containsExactly(publish, PING);
    }

    @Test
    void feed_headerPublish_totalSizeCoversHeadersAndBody() {
        // setup
        String headers = "NATS/1.0\r\n\r\n";
        String body = "hello";
        int total = headers.length() + body.length();
        String publish = "HPUB machine.m-1.hostname " + headers.length() + " " + total + "\r\n" + headers + body + "\r\n";

        // execution
        List<NatsClientCommand> commands = feed(publish + PING);

        // verifications
        assertThat(commands)
                .extracting(NatsClientCommand::operation, command -> text(command.payload()))
                .containsExactly(tuple(NatsOperation.HPUB, headers + body), tuple(NatsOperation.PING, ""));
    }

    @Test
    void feed_publishSizeNotANumber_malformedCommandWithTheLine() {
        // setup
        String line = "PUB machine.m-1.heartbeat abc\r\n";

        // execution
        List<NatsClientCommand> commands = feed(line);

        // verifications
        assertThat(commands)
                .extracting(NatsClientCommand::isMalformed, NatsClientCommand::trouble, command -> text(command.raw()))
                .containsExactly(tuple(true, "PUB payload size is not a number", line));
    }

    @Test
    void feed_payloadAboveTheCap_malformed() {
        // setup
        String line = "PUB machine.m-1.heartbeat " + (MAX_PAYLOAD_BYTES + 1) + "\r\n";

        // execution
        List<NatsClientCommand> commands = feed(line);

        // verifications
        assertThat(commands)
                .extracting(NatsClientCommand::trouble)
                .containsExactly("payload larger than " + MAX_PAYLOAD_BYTES + " bytes");
    }

    @Test
    void feed_controlLineOverflow_malformedAndTheRestUnparsed() {
        // setup
        byte[] overlong = new byte[OVERLONG_LINE_BYTES];
        Arrays.fill(overlong, (byte) 'A');

        // execution
        List<NatsClientCommand> first = assembler.feed(overlong);
        List<NatsClientCommand> next = feed(SUBSCRIBE);

        // verifications
        assertThat(first)
                .extracting(NatsClientCommand::trouble, command -> command.raw().length)
                .containsExactly(tuple("control line longer than 4096 bytes", OVERLONG_LINE_BYTES));
        assertThat(next)
                .extracting(NatsClientCommand::operation, command -> text(command.raw()))
                .containsExactly(tuple(NatsOperation.OTHER, SUBSCRIBE));
    }

    @Test
    void feed_afterRelayUnparsed_everyFrameIsOneUnparsedCommand() {
        // setup
        assembler.relayUnparsed();

        // execution
        List<NatsClientCommand> commands = feed(PING + SUBSCRIBE);

        // verifications
        assertThat(commands)
                .extracting(NatsClientCommand::operation, command -> text(command.raw()))
                .containsExactly(tuple(NatsOperation.OTHER, PING + SUBSCRIBE));
    }

    @Test
    void feed_emptyFrame_noCommands() {
        // execution
        List<NatsClientCommand> commands = feed("");

        // verifications
        assertThat(commands).isEmpty();
    }

    private List<NatsClientCommand> feed(String frame) {
        byte[] bytes = frame.getBytes(UTF_8);
        return assembler.feed(bytes);
    }

    private static String text(byte[] bytes) {
        return new String(bytes, UTF_8);
    }
}
