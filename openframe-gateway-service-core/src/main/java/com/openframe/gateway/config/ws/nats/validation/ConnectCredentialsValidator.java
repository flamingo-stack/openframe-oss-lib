package com.openframe.gateway.config.ws.nats.validation;

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
@Order(ConnectCredentialsValidator.ORDER)
@RequiredArgsConstructor
public class ConnectCredentialsValidator implements NatsCommandValidator {

    static final int ORDER = 100;

    private final NatsConnectOptionsParser natsConnectOptionsParser;

    @Override
    public boolean appliesTo(NatsClientCommand command) {
        return command.operation() == NatsOperation.CONNECT;
    }

    @Override
    public Mono<NatsValidationResult> validate(NatsClientCommand command, NatsClientContext context) {
        Optional<String> credentialField = natsConnectOptionsParser.credentialFieldOf(command.controlLine());
        NatsValidationResult result = credentialField
                .<NatsValidationResult>map(field -> new NatsValidationResult.CloseSession("CONNECT carries " + field))
                .orElse(NatsValidationResult.ALLOWED);
        return Mono.just(result);
    }
}
