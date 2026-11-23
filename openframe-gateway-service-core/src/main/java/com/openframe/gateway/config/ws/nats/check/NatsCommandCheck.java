package com.openframe.gateway.config.ws.nats.check;

import com.openframe.gateway.config.ws.nats.NatsClientContext;
import com.openframe.gateway.config.ws.nats.protocol.NatsClientCommand;
import reactor.core.publisher.Mono;

/**
 * One rule over one kind of client command. Stateless: everything about the session comes in the
 * {@link NatsClientContext}. Order the beans with {@code @Order}; {@link NatsCommandVetter} runs the
 * applicable ones in that order and stops at the first that does not allow.
 */
public interface NatsCommandCheck {

    boolean appliesTo(NatsClientCommand command);

    Mono<NatsVerdict> check(NatsClientCommand command, NatsClientContext context);
}
