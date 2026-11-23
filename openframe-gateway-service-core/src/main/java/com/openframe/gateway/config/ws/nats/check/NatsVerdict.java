package com.openframe.gateway.config.ws.nats.check;

import com.openframe.gateway.config.ws.nats.protocol.NatsOperation;

/** What the checks decided about one client command. */
public sealed interface NatsVerdict {

    NatsVerdict ALLOWED = new Allowed();

    /** Relay the command as it is. */
    record Allowed() implements NatsVerdict {
    }

    /** Drop the command; the client gets the permissions error NATS would have sent. */
    record Refused(NatsOperation operation, String subject) implements NatsVerdict {
    }

    /** End the session: what the client sent must not reach NATS at all. */
    record Closed(String reason) implements NatsVerdict {
    }

    /** NATS could not parse this either; the session decides whether to end or to stop parsing. */
    record ProtocolTrouble(String reason) implements NatsVerdict {
    }

    default boolean isAllowed() {
        return this instanceof Allowed;
    }
}
