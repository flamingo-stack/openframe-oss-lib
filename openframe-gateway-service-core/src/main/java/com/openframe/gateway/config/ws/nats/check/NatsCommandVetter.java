package com.openframe.gateway.config.ws.nats.check;

import com.openframe.gateway.config.ws.nats.NatsClientContext;
import com.openframe.gateway.config.ws.nats.protocol.NatsClientCommand;
import com.openframe.gateway.config.ws.nats.protocol.NatsProtocolException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.List;

/**
 * Runs the {@link NatsCommandCheck}s that apply to a command, in bean order, and answers with the
 * first verdict that is not {@link NatsVerdict.Allowed}. A command the assembler could not parse,
 * or a check that finds a body NATS would not parse either, is {@link NatsVerdict.ProtocolTrouble}.
 */
@Component
@RequiredArgsConstructor
public class NatsCommandVetter {

    private final List<NatsCommandCheck> natsCommandChecks;

    public Mono<NatsVerdict> vet(NatsClientCommand command, NatsClientContext context) {
        if (command.isMalformed()) {
            return Mono.just(new NatsVerdict.ProtocolTrouble(command.trouble()));
        }
        return Flux.fromIterable(natsCommandChecks)
                .filter(check -> check.appliesTo(command))
                .concatMap(check -> check.check(command, context))
                .filter(verdict -> !verdict.isAllowed())
                .next()
                .defaultIfEmpty(NatsVerdict.ALLOWED)
                .onErrorResume(NatsProtocolException.class, NatsCommandVetter::protocolTrouble);
    }

    private static Mono<NatsVerdict> protocolTrouble(NatsProtocolException exception) {
        return Mono.just(new NatsVerdict.ProtocolTrouble(exception.getMessage()));
    }
}
