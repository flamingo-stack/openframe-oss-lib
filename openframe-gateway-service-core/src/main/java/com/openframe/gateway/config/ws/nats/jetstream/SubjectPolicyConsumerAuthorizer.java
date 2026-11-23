package com.openframe.gateway.config.ws.nats.jetstream;

import com.openframe.gateway.config.ws.nats.NatsClientContext;
import com.openframe.gateway.config.ws.nats.policy.NatsSubjectPolicy;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

/**
 * The default rule: a consumer is fine when the client could subscribe to each of its filter
 * subjects directly, so a stream keyed by the caller's own id needs nothing more. A consumer over
 * the whole stream has no filter to judge and is refused.
 */
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class SubjectPolicyConsumerAuthorizer implements StreamConsumerAuthorizer {

    @Override
    public boolean supports(String stream) {
        return true;
    }

    @Override
    public Mono<Boolean> mayConsume(NatsClientContext context, ConsumerCreateRequest request) {
        if (request.isUnfiltered()) {
            return Mono.just(false);
        }
        NatsSubjectPolicy policy = context.getPolicy();
        boolean allowed = request.getFilterSubjects().stream().allMatch(policy::allowsSubscribe);
        return Mono.just(allowed);
    }
}
