package com.openframe.gateway.config.ws.nats.policy;

import com.openframe.gateway.config.ws.nats.NatsClientIdentity;
import com.openframe.gateway.config.ws.nats.NatsClientKind;
import com.openframe.gateway.config.ws.nats.NatsSubjectFilterProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class NatsSubjectPolicyFactory {

    private final NatsSubjectFilterProperties natsSubjectFilterProperties;

    public NatsSubjectPolicy policyFor(NatsClientIdentity identity) {
        NatsClientKind kind = identity.kind();
        String id = identity.id();
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
