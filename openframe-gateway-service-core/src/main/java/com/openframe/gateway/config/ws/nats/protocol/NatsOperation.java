package com.openframe.gateway.config.ws.nats.protocol;

import java.util.Arrays;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

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

    private static final Map<String, NatsOperation> BY_VERB = Arrays.stream(values())
            .collect(Collectors.toUnmodifiableMap(Enum::name, Function.identity()));

    public static NatsOperation of(String verb) {
        String upper = verb.toUpperCase(Locale.ROOT);
        return BY_VERB.getOrDefault(upper, OTHER);
    }

    public boolean isPublish() {
        return this == PUB || this == HPUB;
    }

    public boolean carriesSubject() {
        return this == SUB || isPublish();
    }
}
