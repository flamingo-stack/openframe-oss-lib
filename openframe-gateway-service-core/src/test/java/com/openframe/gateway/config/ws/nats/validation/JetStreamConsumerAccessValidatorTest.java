package com.openframe.gateway.config.ws.nats.validation;

import com.openframe.gateway.config.ws.nats.NatsClientContext;
import com.openframe.gateway.config.ws.nats.NatsTestCommands;
import com.openframe.gateway.config.ws.nats.NatsTestContexts;
import com.openframe.gateway.config.ws.nats.jetstream.JetStreamApiSubjectParser;
import com.openframe.gateway.config.ws.nats.protocol.NatsClientCommand;
import com.openframe.gateway.config.ws.nats.protocol.NatsOperation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class JetStreamConsumerAccessValidatorTest {

    private static final String STREAM = "CHAT_CHUNKS";
    private static final String OWN_CONSUMER = "c-own";
    private static final String FOREIGN_CONSUMER = "c-foreign";
    private static final String PULL_OWN = "$JS.API.CONSUMER.MSG.NEXT.CHAT_CHUNKS." + OWN_CONSUMER;
    private static final String PULL_FOREIGN = "$JS.API.CONSUMER.MSG.NEXT.CHAT_CHUNKS." + FOREIGN_CONSUMER;
    private static final String PULL_BODY = "{\"batch\":1}";

    private NatsClientContext context;
    private JetStreamConsumerAccessValidator validator;

    @BeforeEach
    void setUp() {
        context = NatsTestContexts.device();
        validator = new JetStreamConsumerAccessValidator(new JetStreamApiSubjectParser());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "$JS.API.CONSUMER.INFO.CHAT_CHUNKS.c1",
            "$JS.API.CONSUMER.DELETE.CHAT_CHUNKS.c1",
            "$JS.API.CONSUMER.MSG.NEXT.CHAT_CHUNKS.c1"
    })
    void appliesTo_callOnAnExistingConsumer_true(String subject) {
        // setup
        NatsClientCommand command = NatsTestCommands.publish(subject, PULL_BODY);

        // execution
        boolean applies = validator.appliesTo(command);

        // verifications
        assertThat(applies).isTrue();
    }

    @Test
    void appliesTo_consumerCreate_false() {
        // setup
        NatsClientCommand command = NatsTestCommands.consumerCreate(STREAM, "chat.d-1.message");

        // execution
        boolean applies = validator.appliesTo(command);

        // verifications
        assertThat(applies).isFalse();
    }

    @Test
    void validate_consumerCreatedInThisSession_allowed() {
        // setup
        context.getConsumerRegistry().register(STREAM, OWN_CONSUMER);
        NatsClientCommand command = NatsTestCommands.publish(PULL_OWN, PULL_BODY);

        // execution
        NatsValidationResult result = validator.validate(command, context).block();

        // verifications
        assertThat(result).isEqualTo(NatsValidationResult.ALLOWED);
    }

    @Test
    void validate_consumerOfAnotherSession_refused() {
        // setup
        context.getConsumerRegistry().register(STREAM, OWN_CONSUMER);
        NatsClientCommand command = NatsTestCommands.publish(PULL_FOREIGN, PULL_BODY);

        // execution
        NatsValidationResult result = validator.validate(command, context).block();

        // verifications
        assertThat(result).isEqualTo(new NatsValidationResult.Refused(NatsOperation.PUB, PULL_FOREIGN));
    }
}
