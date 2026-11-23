package com.openframe.gateway.config.ws.nats.validation;

import com.openframe.gateway.config.ws.nats.NatsClientContext;
import com.openframe.gateway.config.ws.nats.policy.NatsSubjectPolicy;
import com.openframe.gateway.config.ws.nats.protocol.NatsClientCommand;
import com.openframe.gateway.config.ws.nats.protocol.NatsOperation;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.util.Optional;

/**
 * A {@code PUB}/{@code HPUB} may only name a subject the client's policy lets it write: its own
 * machine's results and the JetStream API calls it is allowed, never another machine's subjects.
 * Its reply-to, where a responder will publish, must be a subject the client could subscribe to
 * itself (its inbox), or a request would be a way to make a responder publish into someone else's
 * subject.
 */
@Component
@Order(PublishSubjectValidator.ORDER)
public class PublishSubjectValidator implements NatsCommandValidator {

    static final int ORDER = 300;

    @Override
    public boolean appliesTo(NatsClientCommand command) {
        return command.getOperation().isPublish();
    }

    @Override
    public Mono<NatsValidationResult> validate(NatsClientCommand command, NatsClientContext context) {
        String subject = command.getSubject().orElseThrow();
        NatsSubjectPolicy policy = context.getPolicy();
        NatsOperation operation = command.getOperation();
        if (!policy.allowsPublish(subject)) {
            return Mono.just(new NatsValidationResult.Refused(operation, subject));
        }
        if (!isReplySubjectOwn(command, policy)) {
            return Mono.just(new NatsValidationResult.Refused(operation, subject));
        }
        return Mono.just(NatsValidationResult.ALLOWED);
    }

    private static boolean isReplySubjectOwn(NatsClientCommand command, NatsSubjectPolicy policy) {
        Optional<String> replySubject = command.getControlLine().getReplySubject();
        return replySubject
                .map(policy::allowsSubscribe)
                .orElse(true);
    }
}
