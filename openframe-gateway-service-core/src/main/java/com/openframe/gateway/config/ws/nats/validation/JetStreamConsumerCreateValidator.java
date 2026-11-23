package com.openframe.gateway.config.ws.nats.validation;

import com.openframe.gateway.config.ws.nats.NatsClientContext;
import com.openframe.gateway.config.ws.nats.jetstream.ConsumerCreateRequest;
import com.openframe.gateway.config.ws.nats.jetstream.ConsumerCreateRequestParser;
import com.openframe.gateway.config.ws.nats.jetstream.JetStreamApiSubject;
import com.openframe.gateway.config.ws.nats.jetstream.JetStreamApiSubjectParser;
import com.openframe.gateway.config.ws.nats.jetstream.StreamConsumerAuthorizer;
import com.openframe.gateway.config.ws.nats.protocol.NatsClientCommand;
import com.openframe.gateway.config.ws.nats.protocol.NatsOperation;
import lombok.RequiredArgsConstructor;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Optional;

/**
 * A consumer-create is a publish whose body decides what the client will read, so after the
 * publish subject itself passed, the request is parsed and the stream's
 * {@link StreamConsumerAuthorizer} asked. A request whose filter is ambiguous is refused outright:
 * the gateway authorizes only a config it reads the same way NATS will. A push consumer must
 * deliver into a subject the client may subscribe to, or it would be a way to publish into someone
 * else's subject.
 */
@Component
@Order(JetStreamConsumerCreateValidator.ORDER)
@RequiredArgsConstructor
public class JetStreamConsumerCreateValidator implements NatsCommandValidator {

    static final int ORDER = 400;

    private final JetStreamApiSubjectParser jetStreamApiSubjectParser;
    private final ConsumerCreateRequestParser consumerCreateRequestParser;
    private final List<StreamConsumerAuthorizer> streamConsumerAuthorizers;

    @Override
    public boolean appliesTo(NatsClientCommand command) {
        if (!command.getOperation().isPublish()) {
            return false;
        }
        String subject = command.getSubject().orElseThrow();
        return jetStreamApiSubjectParser.consumerCreateOf(subject).isPresent();
    }

    @Override
    public Mono<NatsValidationResult> validate(NatsClientCommand command, NatsClientContext context) {
        String subject = command.getSubject().orElseThrow();
        JetStreamApiSubject apiSubject = jetStreamApiSubjectParser.consumerCreateOf(subject).orElseThrow();
        ConsumerCreateRequest request = consumerCreateRequestParser.parse(apiSubject, command.getPayload());
        NatsOperation operation = command.getOperation();
        NatsValidationResult refused = new NatsValidationResult.Refused(operation, subject);
        if (request.isAmbiguous()) {
            return Mono.just(refused);
        }
        if (!isDeliverSubjectOwn(request, context)) {
            return Mono.just(refused);
        }
        return authorizerFor(request.getStream())
                .mayConsume(context, request)
                .map(allowed -> allowed ? NatsValidationResult.ALLOWED : refused);
    }

    private static boolean isDeliverSubjectOwn(ConsumerCreateRequest request, NatsClientContext context) {
        Optional<String> deliverSubject = request.getDeliverSubject();
        return deliverSubject
                .map(subject -> context.getPolicy().allowsSubscribe(subject))
                .orElse(true);
    }

    private StreamConsumerAuthorizer authorizerFor(String stream) {
        return streamConsumerAuthorizers.stream()
                .filter(authorizer -> authorizer.supports(stream))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("No StreamConsumerAuthorizer supports stream " + stream));
    }
}
