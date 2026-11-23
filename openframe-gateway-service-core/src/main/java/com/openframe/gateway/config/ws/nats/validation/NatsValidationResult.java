package com.openframe.gateway.config.ws.nats.validation;

import com.openframe.gateway.config.ws.nats.protocol.NatsOperation;

/** What the checks decided about one client command. */
public sealed interface NatsValidationResult {

    NatsValidationResult ALLOWED = new Allowed();

    /** Relay the command as it is. */
    record Allowed() implements NatsValidationResult {
    }

    /** Drop the command; the client gets the permissions error NATS would have sent. */
    record Refused(NatsOperation operation, String subject) implements NatsValidationResult {
    }

    /** End the session: what the client sent must not reach NATS at all. */
    record CloseSession(String reason) implements NatsValidationResult {
    }

    /** NATS could not parse this either; the session decides whether to end or to stop parsing. */
    record ProtocolViolation(String reason) implements NatsValidationResult {
    }

    default boolean isAllowed() {
        return this instanceof Allowed;
    }
}
