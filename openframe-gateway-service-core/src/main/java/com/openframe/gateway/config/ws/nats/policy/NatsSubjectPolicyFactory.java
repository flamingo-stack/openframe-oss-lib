package com.openframe.gateway.config.ws.nats.policy;

import com.openframe.gateway.config.ws.nats.NatsClientIdentity;
import com.openframe.gateway.config.ws.nats.NatsClientKind;
import com.openframe.gateway.config.ws.nats.NatsSubjectFilterProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Compiles the configured subject patterns of a client's kind into its {@link NatsSubjectPolicy},
 * with {@code {id}} replaced by its own id, so the per-command checks compare subjects against
 * ready patterns instead of touching the configuration.
 */
@Component
@RequiredArgsConstructor
public class NatsSubjectPolicyFactory {

    private final NatsSubjectFilterProperties natsSubjectFilterProperties;

    public NatsSubjectPolicy policyFor(NatsClientIdentity identity) {
        NatsClientKind kind = identity.getKind();
        String id = identity.getId();
        List<String> publishPatterns = natsSubjectFilterProperties.publishPatternsFor(kind);
        List<String> subscribePatterns = natsSubjectFilterProperties.subscribePatternsFor(kind);
        List<NatsSubjectPattern> publish = compile(publishPatterns, id);
        List<NatsSubjectPattern> subscribe = compile(subscribePatterns, id);
        return new NatsSubjectPolicy(publish, subscribe);
    }

    private static List<NatsSubjectPattern> compile(List<String> patterns, String id) {
        return patterns.stream()
                .map(pattern -> NatsSubjectPattern.compile(pattern, id))
                .toList();
    }
}
