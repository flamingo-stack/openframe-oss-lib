package com.openframe.gateway.config.ws.nats.check;

import com.openframe.gateway.config.ws.nats.NatsClientContext;
import com.openframe.gateway.config.ws.nats.protocol.NatsClientCommand;
import com.openframe.gateway.config.ws.nats.protocol.NatsOperation;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

@Component
@Order(SubscribeSubjectCheck.ORDER)
public class SubscribeSubjectCheck implements NatsCommandCheck {

    static final int ORDER = 200;

    @Override
    public boolean appliesTo(NatsClientCommand command) {
        return command.operation() == NatsOperation.SUB;
    }

    @Override
    public Mono<NatsVerdict> check(NatsClientCommand command, NatsClientContext context) {
        String subject = command.subject().orElseThrow();
        if (context.policy().allowsSubscribe(subject)) {
            return Mono.just(NatsVerdict.ALLOWED);
        }
        return Mono.just(new NatsVerdict.Refused(NatsOperation.SUB, subject));
    }
}
