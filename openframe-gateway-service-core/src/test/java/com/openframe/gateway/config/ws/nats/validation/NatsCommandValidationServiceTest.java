package com.openframe.gateway.config.ws.nats.validation;

import com.openframe.gateway.config.ws.nats.NatsClientContext;
import com.openframe.gateway.config.ws.nats.NatsTestCommands;
import com.openframe.gateway.config.ws.nats.NatsTestContexts;
import com.openframe.gateway.config.ws.nats.protocol.NatsClientCommand;
import com.openframe.gateway.config.ws.nats.protocol.NatsOperation;
import com.openframe.gateway.config.ws.nats.protocol.NatsProtocolException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import reactor.core.publisher.Mono;

import java.util.List;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NatsCommandValidationServiceTest {

    private static final String SUBSCRIBE = "SUB machine.m-1.command-execution 1\r\n";
    private static final NatsValidationResult REFUSED = new NatsValidationResult.Refused(NatsOperation.SUB, "machine.m-1.command-execution");

    @Mock private NatsCommandValidator firstValidator;
    @Mock private NatsCommandValidator secondValidator;

    private NatsClientContext context;
    private NatsClientCommand command;
    private NatsCommandValidationService validationService;

    @BeforeEach
    void setUp() {
        context = NatsTestContexts.device();
        command = NatsTestCommands.command(SUBSCRIBE);
        validationService = new NatsCommandValidationService(List.of(firstValidator, secondValidator));
    }

    @Test
    void validate_everyApplicableValidatorAllows_allowed() {
        // setup
        when(firstValidator.appliesTo(command)).thenReturn(true);
        when(firstValidator.validate(command, context)).thenReturn(Mono.just(NatsValidationResult.ALLOWED));
        when(secondValidator.appliesTo(command)).thenReturn(true);
        when(secondValidator.validate(command, context)).thenReturn(Mono.just(NatsValidationResult.ALLOWED));

        // execution
        NatsValidationResult result = validationService.validate(command, context).block();

        // verifications
        assertThat(result).isEqualTo(NatsValidationResult.ALLOWED);
    }

    @Test
    void validate_firstValidatorRefuses_secondNotAsked() {
        // setup
        when(firstValidator.appliesTo(command)).thenReturn(true);
        when(firstValidator.validate(command, context)).thenReturn(Mono.just(REFUSED));

        // execution
        NatsValidationResult result = validationService.validate(command, context).block();

        // verifications
        assertThat(result).isEqualTo(REFUSED);
        verify(secondValidator, never()).validate(command, context);
    }

    @Test
    void validate_noValidatorApplies_allowed() {
        // setup
        when(firstValidator.appliesTo(command)).thenReturn(false);
        when(secondValidator.appliesTo(command)).thenReturn(false);

        // execution
        NatsValidationResult result = validationService.validate(command, context).block();

        // verifications
        assertThat(result).isEqualTo(NatsValidationResult.ALLOWED);
    }

    @Test
    void validate_malformedCommand_protocolViolationWithoutAskingTheValidators() {
        // setup
        byte[] raw = "PUB x abc\r\n".getBytes(UTF_8);
        NatsClientCommand malformed = NatsClientCommand.malformed(raw, "PUB payload size is not a number");

        // execution
        NatsValidationResult result = validationService.validate(malformed, context).block();

        // verifications
        assertThat(result).isEqualTo(new NatsValidationResult.ProtocolViolation("PUB payload size is not a number"));
        verify(firstValidator, never()).appliesTo(malformed);
    }

    @Test
    void validate_validatorFindsUnparsableBody_protocolViolation() {
        // setup
        when(firstValidator.appliesTo(command)).thenReturn(true);
        when(firstValidator.validate(command, context)).thenReturn(Mono.error(new NatsProtocolException("CONNECT options are not JSON")));

        // execution
        NatsValidationResult result = validationService.validate(command, context).block();

        // verifications
        assertThat(result).isEqualTo(new NatsValidationResult.ProtocolViolation("CONNECT options are not JSON"));
    }
}
