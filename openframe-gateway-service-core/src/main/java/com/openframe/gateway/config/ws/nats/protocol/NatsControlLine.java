package com.openframe.gateway.config.ws.nats.protocol;

import java.util.List;
import java.util.Optional;

import static java.nio.charset.StandardCharsets.UTF_8;

/**
 * One parsed NATS control line. {@code raw} keeps the bytes as the client sent them, line end
 * included, so an allowed line is relayed byte for byte.
 */
public record NatsControlLine(
        NatsOperation operation,
        List<String> tokens,
        long payloadSize,
        byte[] raw
) {

    private static final int SUBJECT_INDEX = 1;
    private static final long NO_PAYLOAD = 0;

    public Optional<String> subject() {
        if (!operation.carriesSubject()) {
            return Optional.empty();
        }
        return Optional.of(tokens.get(SUBJECT_INDEX));
    }

    public boolean hasPayload() {
        return payloadSize > NO_PAYLOAD;
    }

    public String verb() {
        return tokens.get(0);
    }

    /** Everything after the verb, which for {@code CONNECT} is its JSON options object. */
    public String arguments() {
        String line = new String(raw, UTF_8).strip();
        return line.substring(verb().length()).strip();
    }
}
