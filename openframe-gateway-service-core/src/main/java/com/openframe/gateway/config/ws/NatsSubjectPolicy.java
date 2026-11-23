package com.openframe.gateway.config.ws;

import java.util.List;

/**
 * The subjects one NATS websocket client may publish to and subscribe to: the patterns of its
 * {@link NatsClientKind} with {@code {id}} replaced by its own id.
 */
final class NatsSubjectPolicy {

    private final List<NatsSubjectPattern> publish;
    private final List<NatsSubjectPattern> subscribe;

    private NatsSubjectPolicy(List<NatsSubjectPattern> publish, List<NatsSubjectPattern> subscribe) {
        this.publish = publish;
        this.subscribe = subscribe;
    }

    static NatsSubjectPolicy of(NatsSubjectFilterProperties properties, NatsClientIdentity identity) {
        NatsClientKind kind = identity.kind();
        String id = identity.id();
        List<String> publishPatterns = properties.publishPatternsFor(kind);
        List<String> subscribePatterns = properties.subscribePatternsFor(kind);
        List<NatsSubjectPattern> publish = compile(publishPatterns, id);
        List<NatsSubjectPattern> subscribe = compile(subscribePatterns, id);
        return new NatsSubjectPolicy(publish, subscribe);
    }

    boolean allowsPublish(String subject) {
        return isCovered(publish, subject);
    }

    boolean allowsSubscribe(String subject) {
        return isCovered(subscribe, subject);
    }

    private static List<NatsSubjectPattern> compile(List<String> patterns, String id) {
        return patterns.stream()
                .map(pattern -> NatsSubjectPattern.compile(pattern, id))
                .toList();
    }

    private static boolean isCovered(List<NatsSubjectPattern> patterns, String subject) {
        return patterns.stream().anyMatch(pattern -> pattern.covers(subject));
    }
}
