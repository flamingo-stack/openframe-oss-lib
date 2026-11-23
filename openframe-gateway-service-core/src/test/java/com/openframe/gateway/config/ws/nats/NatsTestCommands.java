package com.openframe.gateway.config.ws.nats;

import com.openframe.gateway.config.ws.nats.protocol.NatsClientCommand;
import com.openframe.gateway.config.ws.nats.protocol.NatsCommandAssembler;
import com.openframe.gateway.config.ws.nats.protocol.NatsControlLineParser;

import java.util.List;

import static java.nio.charset.StandardCharsets.UTF_8;

/** Complete client commands built from protocol text, for the tests of the validators. */
public final class NatsTestCommands {

    private static final long MAX_PAYLOAD_BYTES = 1024 * 1024;

    private NatsTestCommands() {
    }

    public static NatsClientCommand command(String protocolText) {
        NatsCommandAssembler assembler = new NatsCommandAssembler(new NatsControlLineParser(), MAX_PAYLOAD_BYTES);
        byte[] bytes = protocolText.getBytes(UTF_8);
        List<NatsClientCommand> commands = assembler.feed(bytes);
        if (commands.size() != 1) {
            throw new IllegalArgumentException("expected exactly one complete command in: " + protocolText);
        }
        return commands.get(0);
    }

    public static NatsClientCommand consumerCreate(String stream, String filterSubject) {
        String body = "{\"stream_name\":\"" + stream + "\",\"config\":{\"filter_subject\":\"" + filterSubject + "\"}}";
        return publish("$JS.API.CONSUMER.CREATE." + stream + ".c1." + filterSubject, body);
    }

    public static NatsClientCommand publish(String subject, String body) {
        return command("PUB " + subject + " " + body.length() + "\r\n" + body + "\r\n");
    }
}
