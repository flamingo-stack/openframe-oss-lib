package com.openframe.gateway.config.ws.nats.jetstream;

import lombok.Value;

/**
 * A call on an existing consumer, as its API subject spells it:
 * {@code $JS.API.CONSUMER.INFO|DELETE|MSG.NEXT.<stream>.<consumer>}.
 */
@Value
public class JetStreamConsumerAccess {

    String stream;
    String consumerName;
}
