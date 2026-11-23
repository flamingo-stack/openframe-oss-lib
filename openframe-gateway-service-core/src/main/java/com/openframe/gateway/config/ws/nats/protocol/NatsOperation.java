package com.openframe.gateway.config.ws.nats.protocol;

import java.util.Locale;

/** The client-side verbs of the NATS protocol; everything else is {@link #OTHER} and relayed as is. */
public enum NatsOperation {
    CONNECT,
    SUB,
    UNSUB,
    PUB,
    HPUB,
    PING,
    PONG,
    OTHER;

    public static NatsOperation of(String verb) {
        String upper = verb.toUpperCase(Locale.ROOT);
        for (NatsOperation operation : values()) {
            if (operation.name().equals(upper)) {
                return operation;
            }
        }
        return OTHER;
    }

    public boolean isPublish() {
        return this == PUB || this == HPUB;
    }

    public boolean carriesSubject() {
        return this == SUB || isPublish();
    }
}
