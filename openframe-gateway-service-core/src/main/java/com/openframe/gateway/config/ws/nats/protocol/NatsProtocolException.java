package com.openframe.gateway.config.ws.nats.protocol;

/** A line or payload NATS itself would not accept; what to do about it is the session's call. */
public class NatsProtocolException extends RuntimeException {

    public NatsProtocolException(String message) {
        super(message);
    }
}
