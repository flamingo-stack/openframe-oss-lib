package com.openframe.gateway.config.ws;

/**
 * The NATS client stream must be cut: a {@code CONNECT} with credentials or a control line NATS
 * could not parse, while the filter is enforcing.
 */
class NatsStreamRejectedException extends RuntimeException {

    NatsStreamRejectedException(String message) {
        super(message);
    }
}
