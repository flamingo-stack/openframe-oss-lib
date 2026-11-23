package com.openframe.gateway.config.ws.nats.validation;

import com.openframe.gateway.config.ws.nats.protocol.NatsOperation;
import lombok.Value;

/** What the validators decided about one client command. */
public sealed interface NatsValidationResult {

    NatsValidationResult ALLOWED = new Allowed();

    default boolean isAllowed() {
        return this instanceof Allowed;
    }

    /** Relay the command as it is. */
    @Value
    class Allowed implements NatsValidationResult {
    }

    /** Drop the command; the client gets the permissions error NATS would have sent. */
    @Value
    class Refused implements NatsValidationResult {
        NatsOperation operation;
        String subject;
    }

    /** End the session: what the client sent must not reach NATS at all. */
    @Value
    class CloseSession implements NatsValidationResult {
        String reason;
    }

    /** NATS could not parse this either; the session decides whether to end or to stop parsing. */
    @Value
    class ProtocolViolation implements NatsValidationResult {
        String reason;
    }
}
