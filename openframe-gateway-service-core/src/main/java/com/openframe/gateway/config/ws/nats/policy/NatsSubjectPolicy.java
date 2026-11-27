package com.openframe.gateway.config.ws.nats.policy;

import java.util.List;

/**
 * The subjects one NATS websocket client may publish to and subscribe to: the patterns of its kind
 * with {@code {id}} replaced by its own id.
 */
public final class NatsSubjectPolicy {

    private final List<NatsSubjectPattern> publish;
    private final List<NatsSubjectPattern> subscribe;

    NatsSubjectPolicy(List<NatsSubjectPattern> publish, List<NatsSubjectPattern> subscribe) {
        this.publish = publish;
        this.subscribe = subscribe;
    }

    public boolean allowsPublish(String subject) {
        return isCovered(publish, subject);
    }

    public boolean allowsSubscribe(String subject) {
        return isCovered(subscribe, subject);
    }

    private static boolean isCovered(List<NatsSubjectPattern> patterns, String subject) {
        return patterns.stream().anyMatch(pattern -> pattern.covers(subject));
    }
}
