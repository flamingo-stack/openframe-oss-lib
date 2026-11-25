package com.openframe.gateway.config.ws.nats.validation;

import com.openframe.gateway.config.ws.nats.NatsClientContext;
import com.openframe.gateway.config.ws.nats.jetstream.JetStreamApiSubjectParser;
import com.openframe.gateway.config.ws.nats.jetstream.JetStreamConsumerAccess;
import com.openframe.gateway.config.ws.nats.jetstream.SessionConsumerRegistry;
import com.openframe.gateway.config.ws.nats.protocol.NatsClientCommand;
import com.openframe.gateway.config.ws.nats.protocol.NatsOperation;
import lombok.RequiredArgsConstructor;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

/**
 * {@code CONSUMER.INFO}, {@code DELETE} and {@code MSG.NEXT} name a consumer and nothing else, and
 * the subject permissions cannot tell whose consumer that is. A session may only touch the
 * consumers it created through this gateway, so a client that learns another client's consumer
 * name can neither drain nor delete it.
 */
@Component
@Order(JetStreamConsumerAccessValidator.ORDER)
@RequiredArgsConstructor
public class JetStreamConsumerAccessValidator implements NatsCommandValidator {

    static final int ORDER = 500;

    private final JetStreamApiSubjectParser jetStreamApiSubjectParser;

    @Override
    public boolean appliesTo(NatsClientCommand command) {
        if (!command.getOperation().isPublish()) {
            return false;
        }
        String subject = command.getSubject().orElseThrow();
        return jetStreamApiSubjectParser.consumerAccessOf(subject).isPresent();
    }

    @Override
    public Mono<NatsValidationResult> validate(NatsClientCommand command, NatsClientContext context) {
        String subject = command.getSubject().orElseThrow();
        JetStreamConsumerAccess access = jetStreamApiSubjectParser.consumerAccessOf(subject).orElseThrow();
        SessionConsumerRegistry registry = context.getConsumerRegistry();
        if (registry.isOwned(access.getStream(), access.getConsumerName())) {
            return Mono.just(NatsValidationResult.ALLOWED);
        }
        NatsOperation operation = command.getOperation();
        return Mono.just(new NatsValidationResult.Refused(operation, subject));
    }
}
