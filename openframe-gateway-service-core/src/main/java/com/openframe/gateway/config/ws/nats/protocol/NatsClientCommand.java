package com.openframe.gateway.config.ws.nats.protocol;

import java.util.Optional;

/**
 * One unit of what a client sent, complete: a control line with its payload when it has one, or
 * bytes the session relays without parsing, or bytes NATS could not parse either.
 */
public record NatsClientCommand(
        NatsControlLine controlLine,
        byte[] payload,
        byte[] raw,
        String trouble
) {

    private static final byte[] NO_PAYLOAD = new byte[0];

    public static NatsClientCommand parsed(NatsControlLine controlLine, byte[] payload, byte[] raw) {
        return new NatsClientCommand(controlLine, payload, raw, null);
    }

    public static NatsClientCommand unparsed(byte[] raw) {
        return new NatsClientCommand(null, NO_PAYLOAD, raw, null);
    }

    public static NatsClientCommand malformed(byte[] raw, String trouble) {
        return new NatsClientCommand(null, NO_PAYLOAD, raw, trouble);
    }

    public boolean isMalformed() {
        return trouble != null;
    }

    public NatsOperation operation() {
        return controlLine == null ? NatsOperation.OTHER : controlLine.operation();
    }

    public Optional<String> subject() {
        return controlLine == null ? Optional.empty() : controlLine.subject();
    }
}
