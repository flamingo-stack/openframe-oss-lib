package com.openframe.gateway.config.ws.nats.policy;

import com.openframe.gateway.config.ws.nats.NatsClientIdentity;
import com.openframe.gateway.config.ws.nats.NatsClientKind;
import com.openframe.gateway.config.ws.nats.NatsSubjectFilterProperties;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;

/**
 * Compiles the subject patterns of a client's kind — the configured OSS ones plus whatever the
 * {@link NatsSubjectPatternContributor}s of the product add — into its {@link NatsSubjectPolicy},
 * with {@code {id}} replaced by its own id, so the per-command checks compare subjects against
 * ready patterns instead of touching the configuration.
 */
@Component
public class NatsSubjectPolicyFactory {

    private final NatsSubjectFilterProperties natsSubjectFilterProperties;
    private final List<NatsSubjectPatternContributor> natsSubjectPatternContributors;

    @Autowired
    public NatsSubjectPolicyFactory(NatsSubjectFilterProperties natsSubjectFilterProperties,
                                    ObjectProvider<NatsSubjectPatternContributor> natsSubjectPatternContributors) {
        this(natsSubjectFilterProperties, natsSubjectPatternContributors.orderedStream().toList());
    }

    public NatsSubjectPolicyFactory(NatsSubjectFilterProperties natsSubjectFilterProperties,
                                    List<NatsSubjectPatternContributor> natsSubjectPatternContributors) {
        this.natsSubjectFilterProperties = natsSubjectFilterProperties;
        this.natsSubjectPatternContributors = natsSubjectPatternContributors;
    }

    public NatsSubjectPolicy policyFor(NatsClientIdentity identity) {
        NatsClientKind kind = identity.getKind();
        String id = identity.getId();
        List<String> configuredPublish = natsSubjectFilterProperties.publishPatternsFor(kind);
        List<String> configuredSubscribe = natsSubjectFilterProperties.subscribePatternsFor(kind);
        List<String> publishPatterns = withContributed(configuredPublish, contributor -> contributor.publishPatternsFor(kind));
        List<String> subscribePatterns = withContributed(configuredSubscribe, contributor -> contributor.subscribePatternsFor(kind));
        List<NatsSubjectPattern> publish = compile(publishPatterns, id);
        List<NatsSubjectPattern> subscribe = compile(subscribePatterns, id);
        return new NatsSubjectPolicy(publish, subscribe);
    }

    private List<String> withContributed(List<String> configured,
                                         Function<NatsSubjectPatternContributor, List<String>> contributed) {
        List<String> patterns = new ArrayList<>(configured);
        natsSubjectPatternContributors.stream()
                .map(contributed)
                .forEach(patterns::addAll);
        return List.copyOf(patterns);
    }

    private static List<NatsSubjectPattern> compile(List<String> patterns, String id) {
        return patterns.stream()
                .map(pattern -> NatsSubjectPattern.compile(pattern, id))
                .toList();
    }
}
