package com.openframe.gateway.config.ws.nats.jetstream;

import lombok.Builder;
import lombok.Value;

import java.util.Optional;

/**
 * A consumer-create call as its API subject spells it: {@code $JS.API.CONSUMER.CREATE.<stream>},
 * {@code …CREATE.<stream>.<consumer>} or the filtered {@code …CREATE.<stream>.<consumer>.<filter>},
 * plus the legacy {@code $JS.API.CONSUMER.DURABLE.CREATE.<stream>.<durable>}.
 */
@Value
@Builder
public class JetStreamApiSubject {

    String stream;
    String consumerName;
    String filterSubject;

    public Optional<String> getConsumerName() {
        return Optional.ofNullable(consumerName);
    }

    public Optional<String> getFilterSubject() {
        return Optional.ofNullable(filterSubject);
    }
}
