package com.openframe.gateway.config.ws.nats.validation;

import com.openframe.gateway.config.ws.nats.NatsClientContext;
import com.openframe.gateway.config.ws.nats.protocol.NatsClientCommand;
import com.openframe.gateway.config.ws.nats.protocol.NatsProtocolException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.List;

/**
 * Runs the {@link NatsCommandValidator}s that apply to a command, in bean order, and answers with the
 * first result that is not {@link NatsValidationResult.Allowed}. A command the assembler could not parse,
 * or a validator that finds a body NATS would not parse either, is {@link NatsValidationResult.ProtocolViolation}.
 */
@Component
@RequiredArgsConstructor
public class NatsCommandValidationService {

    private final List<NatsCommandValidator> natsCommandValidators;

    public Mono<NatsValidationResult> validate(NatsClientCommand command, NatsClientContext context) {
        if (command.isMalformed()) {
            return Mono.just(new NatsValidationResult.ProtocolViolation(command.getTrouble()));
        }
        return Flux.fromIterable(natsCommandValidators)
                .filter(validator -> validator.appliesTo(command))
                .concatMap(validator -> validator.validate(command, context))
                .filter(result -> !result.isAllowed())
                .next()
                .defaultIfEmpty(NatsValidationResult.ALLOWED)
                .onErrorResume(NatsProtocolException.class, NatsCommandValidationService::protocolViolation);
    }

    private static Mono<NatsValidationResult> protocolViolation(NatsProtocolException exception) {
        return Mono.just(new NatsValidationResult.ProtocolViolation(exception.getMessage()));
    }
}
