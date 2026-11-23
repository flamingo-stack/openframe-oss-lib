package com.openframe.gateway.config.ws.nats.validation;

import com.openframe.gateway.config.ws.nats.NatsClientContext;
import com.openframe.gateway.config.ws.nats.NatsTestCommands;
import com.openframe.gateway.config.ws.nats.NatsTestContexts;
import com.openframe.gateway.config.ws.nats.jetstream.ConsumerCreateRequest;
import com.openframe.gateway.config.ws.nats.jetstream.ConsumerCreateRequestParser;
import com.openframe.gateway.config.ws.nats.jetstream.JetStreamApiSubjectParser;
import com.openframe.gateway.config.ws.nats.jetstream.StreamConsumerAuthorizer;
import com.openframe.gateway.config.ws.nats.jetstream.SubjectPolicyConsumerAuthorizer;
import com.openframe.gateway.config.ws.nats.protocol.NatsClientCommand;
import com.openframe.gateway.config.ws.nats.protocol.NatsOperation;
import com.openframe.gateway.config.ws.nats.protocol.NatsProtocolException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Captor;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import reactor.core.publisher.Mono;
import tools.jackson.databind.ObjectMapper;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JetStreamConsumerCreateValidatorTest {

    private static final String CHAT_STREAM = "CHAT_CHUNKS";
    private static final String TIMEZONE_STREAM = "MACHINE_TIMEZONE_REQUEST";
    private static final String DIALOG_SUBJECT = "chat.d-1.message";
    private static final String CREATE_SUBJECT = "$JS.API.CONSUMER.CREATE.CHAT_CHUNKS.c1.chat.d-1.message";

    @Mock private StreamConsumerAuthorizer chatAuthorizer;

    @Captor private ArgumentCaptor<ConsumerCreateRequest> requestCaptor;

    private JetStreamConsumerCreateValidator validator;

    @BeforeEach
    void setUp() {
        List<StreamConsumerAuthorizer> authorizers = List.of(chatAuthorizer, new SubjectPolicyConsumerAuthorizer());
        validator = new JetStreamConsumerCreateValidator(new JetStreamApiSubjectParser(),
                new ConsumerCreateRequestParser(new ObjectMapper()), authorizers);
    }

    @Test
    void appliesTo_consumerCreatePublish_true() {
        // setup
        NatsClientCommand command = NatsTestCommands.consumerCreate(CHAT_STREAM, DIALOG_SUBJECT);

        // execution
        boolean applies = validator.appliesTo(command);

        // verifications
        assertThat(applies).isTrue();
    }

    @Test
    void appliesTo_ordinaryPublish_false() {
        // setup
        NatsClientCommand command = NatsTestCommands.publish("machine.m-1.heartbeat", "hi");

        // execution
        boolean applies = validator.appliesTo(command);

        // verifications
        assertThat(applies).isFalse();
    }

    @Test
    void check_streamAuthorizerAllows_allowedAndRequestHandedOver() {
        // setup
        NatsClientContext context = NatsTestContexts.device();
        NatsClientCommand command = NatsTestCommands.consumerCreate(CHAT_STREAM, DIALOG_SUBJECT);
        when(chatAuthorizer.supports(CHAT_STREAM)).thenReturn(true);
        when(chatAuthorizer.mayConsume(eq(context), requestCaptor.capture())).thenReturn(Mono.just(true));

        // execution
        NatsValidationResult result = validator.validate(command, context).block();

        // verifications
        assertThat(result).isEqualTo(NatsValidationResult.ALLOWED);
        assertThat(requestCaptor.getValue().getFilterSubjects()).containsExactly(DIALOG_SUBJECT);
    }

    @Test
    void check_streamAuthorizerRefuses_refusedWithThePublishSubject() {
        // setup
        NatsClientContext context = NatsTestContexts.user();
        NatsClientCommand command = NatsTestCommands.consumerCreate(CHAT_STREAM, DIALOG_SUBJECT);
        when(chatAuthorizer.supports(CHAT_STREAM)).thenReturn(true);
        when(chatAuthorizer.mayConsume(eq(context), requestCaptor.capture())).thenReturn(Mono.just(false));

        // execution
        NatsValidationResult result = validator.validate(command, context).block();

        // verifications
        assertThat(result).isEqualTo(new NatsValidationResult.Refused(NatsOperation.PUB, CREATE_SUBJECT));
    }

    @Test
    void check_noStreamAuthorizer_subjectPolicyDecides() {
        // setup
        NatsClientContext context = NatsTestContexts.device();
        NatsClientCommand command = NatsTestCommands.consumerCreate(TIMEZONE_STREAM, "machine.m-1.timezone.request");
        when(chatAuthorizer.supports(TIMEZONE_STREAM)).thenReturn(false);

        // execution
        NatsValidationResult result = validator.validate(command, context).block();

        // verifications
        assertThat(result).isEqualTo(NatsValidationResult.ALLOWED);
    }

    @Test
    void check_pushConsumerDeliveringOutsideTheClientsSubjects_refusedBeforeAnyAuthorizer() {
        // setup
        NatsClientContext context = NatsTestContexts.device();
        String body = "{\"config\":{\"filter_subject\":\"chat.d-1.message\",\"deliver_subject\":\"machine.m-2.command-execution\"}}";
        NatsClientCommand command = NatsTestCommands.publish(CREATE_SUBJECT, body);

        // execution
        NatsValidationResult result = validator.validate(command, context).block();

        // verifications
        assertThat(result).isEqualTo(new NatsValidationResult.Refused(NatsOperation.PUB, CREATE_SUBJECT));
    }

    @Test
    void check_durableConsumer_refusedBeforeAnyAuthorizer() {
        // setup
        NatsClientContext context = NatsTestContexts.user();
        String body = "{\"config\":{\"durable_name\":\"d1\",\"filter_subject\":\"chat.d-1.message\"}}";
        NatsClientCommand command = NatsTestCommands.publish(CREATE_SUBJECT, body);

        // execution
        NatsValidationResult result = validator.validate(command, context).block();

        // verifications
        assertThat(result).isEqualTo(new NatsValidationResult.Refused(NatsOperation.PUB, CREATE_SUBJECT));
        verifyNoInteractions(chatAuthorizer);
    }

    @Test
    void check_ambiguousFilter_refusedBeforeAnyAuthorizer() {
        // setup
        NatsClientContext context = NatsTestContexts.user();
        String body = "{\"config\":{\"filter_subject\":\"chat.d-1.message\",\"filter_subjects\":[\"chat.d-2.message\"]}}";
        NatsClientCommand command = NatsTestCommands.publish(CREATE_SUBJECT, body);

        // execution
        NatsValidationResult result = validator.validate(command, context).block();

        // verifications
        assertThat(result).isEqualTo(new NatsValidationResult.Refused(NatsOperation.PUB, CREATE_SUBJECT));
        verifyNoInteractions(chatAuthorizer);
    }

    @Test
    void check_bodyNotJson_throwsProtocolException() {
        // setup
        NatsClientContext context = NatsTestContexts.device();
        NatsClientCommand command = NatsTestCommands.publish(CREATE_SUBJECT, "not-json");

        // execution
        NatsProtocolException exception = assertThrows(NatsProtocolException.class, () -> validator.validate(command, context));

        // verifications
        assertThat(exception.getMessage()).contains("JSON");
    }
}
