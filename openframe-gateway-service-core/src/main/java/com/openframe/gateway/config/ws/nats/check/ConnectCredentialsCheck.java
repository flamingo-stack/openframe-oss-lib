package com.openframe.gateway.config.ws.nats.check;

import com.openframe.gateway.config.ws.nats.NatsClientContext;
import com.openframe.gateway.config.ws.nats.protocol.NatsClientCommand;
import com.openframe.gateway.config.ws.nats.protocol.NatsConnectOptionsParser;
import com.openframe.gateway.config.ws.nats.protocol.NatsOperation;
import lombok.RequiredArgsConstructor;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.util.Optional;

/** A {@code CONNECT} with a credential ends the session: nothing through the gateway needs one. */
@Component
@Order(ConnectCredentialsCheck.ORDER)
@RequiredArgsConstructor
public class ConnectCredentialsCheck implements NatsCommandCheck {

    static final int ORDER = 100;

    private final NatsConnectOptionsParser natsConnectOptionsParser;

    @Override
    public boolean appliesTo(NatsClientCommand command) {
        return command.operation() == NatsOperation.CONNECT;
    }

    @Override
    public Mono<NatsVerdict> check(NatsClientCommand command, NatsClientContext context) {
        Optional<String> credentialField = natsConnectOptionsParser.credentialFieldOf(command.controlLine());
        NatsVerdict verdict = credentialField
                .<NatsVerdict>map(field -> new NatsVerdict.Closed("CONNECT carries " + field))
                .orElse(NatsVerdict.ALLOWED);
        return Mono.just(verdict);
    }
}
