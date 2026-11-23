package com.openframe.gateway.config.ws.nats.jetstream;

import java.util.Optional;

/**
 * A consumer-create call as its API subject spells it: {@code $JS.API.CONSUMER.CREATE.<stream>},
 * {@code …CREATE.<stream>.<consumer>} or the filtered {@code …CREATE.<stream>.<consumer>.<filter>},
 * plus the legacy {@code $JS.API.CONSUMER.DURABLE.CREATE.<stream>.<durable>}.
 */
public record JetStreamApiSubject(String stream, Optional<String> consumerName, Optional<String> filterSubject) {
}
