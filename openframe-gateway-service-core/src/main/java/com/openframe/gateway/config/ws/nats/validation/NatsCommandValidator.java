package com.openframe.gateway.config.ws.nats.validation;

import com.openframe.gateway.config.ws.nats.NatsClientContext;
import com.openframe.gateway.config.ws.nats.protocol.NatsClientCommand;
import reactor.core.publisher.Mono;

/**
 * One validation rule over one kind of client command. Stateless: everything about the session comes in the
 * {@link NatsClientContext}. Order the beans with {@code @Order}; {@link NatsCommandValidationService} runs the
 * applicable ones in that order and stops at the first that does not allow.
 */
public interface NatsCommandValidator {

    boolean appliesTo(NatsClientCommand command);

    Mono<NatsValidationResult> validate(NatsClientCommand command, NatsClientContext context);
}
