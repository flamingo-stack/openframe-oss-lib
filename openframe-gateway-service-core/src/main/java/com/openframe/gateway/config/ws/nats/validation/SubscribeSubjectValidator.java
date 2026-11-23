package com.openframe.gateway.config.ws.nats.validation;

import com.openframe.gateway.config.ws.nats.NatsClientContext;
import com.openframe.gateway.config.ws.nats.protocol.NatsClientCommand;
import com.openframe.gateway.config.ws.nats.protocol.NatsOperation;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

@Component
@Order(SubscribeSubjectValidator.ORDER)
public class SubscribeSubjectValidator implements NatsCommandValidator {

    static final int ORDER = 200;

    @Override
    public boolean appliesTo(NatsClientCommand command) {
        return command.getOperation() == NatsOperation.SUB;
    }

    @Override
    public Mono<NatsValidationResult> validate(NatsClientCommand command, NatsClientContext context) {
        String subject = command.getSubject().orElseThrow();
        if (context.getPolicy().allowsSubscribe(subject)) {
            return Mono.just(NatsValidationResult.ALLOWED);
        }
        return Mono.just(new NatsValidationResult.Refused(NatsOperation.SUB, subject));
    }
}
