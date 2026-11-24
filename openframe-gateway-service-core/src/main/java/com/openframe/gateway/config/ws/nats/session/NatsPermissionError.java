package com.openframe.gateway.config.ws.nats.session;

import com.openframe.gateway.config.ws.nats.validation.NatsValidationResult;
import com.openframe.gateway.config.ws.nats.protocol.NatsOperation;

import static java.nio.charset.StandardCharsets.UTF_8;

/**
 * The {@code -ERR} NATS sends for a subject outside the client's permissions, word for word:
 * nats.ws and the desktop match it to the subscription or request they sent by exact subject, so
 * the refused subscription closes with the error and a refused request fails at once.
 */
final class NatsPermissionError {

    private static final String SUBSCRIBE_ERROR = "-ERR 'Permissions Violation for Subscription to \"%s\"'\r\n";
    private static final String PUBLISH_ERROR = "-ERR 'Permissions Violation for Publish to \"%s\"'\r\n";

    private NatsPermissionError() {
    }

    static byte[] of(NatsValidationResult.Refused refused) {
        String template = refused.getOperation() == NatsOperation.SUB ? SUBSCRIBE_ERROR : PUBLISH_ERROR;
        String error = String.format(template, refused.getSubject());
        return error.getBytes(UTF_8);
    }
}
