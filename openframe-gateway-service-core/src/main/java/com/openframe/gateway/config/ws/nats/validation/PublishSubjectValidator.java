package com.openframe.gateway.config.ws.nats.validation;

import com.openframe.gateway.config.ws.nats.NatsClientContext;
import com.openframe.gateway.config.ws.nats.protocol.NatsClientCommand;
import com.openframe.gateway.config.ws.nats.protocol.NatsOperation;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

/**
 * A {@code PUB}/{@code HPUB} may only name a subject the client's policy lets it write: its own
 * machine's results and the JetStream API calls it is allowed, never another machine's subjects.
 */
@Component
@Order(PublishSubjectValidator.ORDER)
public class PublishSubjectValidator implements NatsCommandValidator {

    static final int ORDER = 300;

    @Override
    public boolean appliesTo(NatsClientCommand command) {
        return command.getOperation().isPublish();
    }

    @Override
    public Mono<NatsValidationResult> validate(NatsClientCommand command, NatsClientContext context) {
        String subject = command.getSubject().orElseThrow();
        if (context.getPolicy().allowsPublish(subject)) {
            return Mono.just(NatsValidationResult.ALLOWED);
        }
        NatsOperation operation = command.getOperation();
        return Mono.just(new NatsValidationResult.Refused(operation, subject));
    }
}
