package com.openframe.gateway.config.ws.nats.check;

import com.openframe.gateway.config.ws.nats.NatsClientContext;
import com.openframe.gateway.config.ws.nats.protocol.NatsClientCommand;
import com.openframe.gateway.config.ws.nats.protocol.NatsOperation;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

@Component
@Order(PublishSubjectCheck.ORDER)
public class PublishSubjectCheck implements NatsCommandCheck {

    static final int ORDER = 300;

    @Override
    public boolean appliesTo(NatsClientCommand command) {
        return command.operation().isPublish();
    }

    @Override
    public Mono<NatsVerdict> check(NatsClientCommand command, NatsClientContext context) {
        String subject = command.subject().orElseThrow();
        if (context.policy().allowsPublish(subject)) {
            return Mono.just(NatsVerdict.ALLOWED);
        }
        NatsOperation operation = command.operation();
        return Mono.just(new NatsVerdict.Refused(operation, subject));
    }
}
