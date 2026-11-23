package com.openframe.gateway.config.ws.nats.jetstream;

import com.openframe.gateway.config.ws.nats.NatsClientContext;
import reactor.core.publisher.Mono;

/**
 * Decides whether a client may create a consumer on a stream. The subject permissions of NATS do
 * not see a consumer's filter — it travels in the request body — so this is where a stream whose
 * subjects are not scoped by the caller's id (a chat stream keyed by dialog, say) gets its own
 * rule, typically one that reads the owning record. The first authorizer that
 * {@link #supports supports} the stream decides; {@link SubjectPolicyConsumerAuthorizer} is the
 * last resort for every stream.
 */
public interface StreamConsumerAuthorizer {

    boolean supports(String stream);

    Mono<Boolean> mayConsume(NatsClientContext context, ConsumerCreateRequest request);
}
