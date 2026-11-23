package com.openframe.gateway.config.ws.nats.check;

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
class NatsCommandVetterTest {

    private static final String SUBSCRIBE = "SUB machine.m-1.command-execution 1\r\n";
    private static final NatsVerdict REFUSED = new NatsVerdict.Refused(NatsOperation.SUB, "machine.m-1.command-execution");

    @Mock private NatsCommandCheck firstCheck;
    @Mock private NatsCommandCheck secondCheck;

    private NatsClientContext context;
    private NatsClientCommand command;
    private NatsCommandVetter vetter;

    @BeforeEach
    void setUp() {
        context = NatsTestContexts.device();
        command = NatsTestCommands.command(SUBSCRIBE);
        vetter = new NatsCommandVetter(List.of(firstCheck, secondCheck));
    }

    @Test
    void vet_everyApplicableCheckAllows_allowed() {
        // setup
        when(firstCheck.appliesTo(command)).thenReturn(true);
        when(firstCheck.check(command, context)).thenReturn(Mono.just(NatsVerdict.ALLOWED));
        when(secondCheck.appliesTo(command)).thenReturn(true);
        when(secondCheck.check(command, context)).thenReturn(Mono.just(NatsVerdict.ALLOWED));

        // execution
        NatsVerdict verdict = vetter.vet(command, context).block();

        // verifications
        assertThat(verdict).isEqualTo(NatsVerdict.ALLOWED);
    }

    @Test
    void vet_firstCheckRefuses_secondNotAsked() {
        // setup
        when(firstCheck.appliesTo(command)).thenReturn(true);
        when(firstCheck.check(command, context)).thenReturn(Mono.just(REFUSED));

        // execution
        NatsVerdict verdict = vetter.vet(command, context).block();

        // verifications
        assertThat(verdict).isEqualTo(REFUSED);
        verify(secondCheck, never()).check(command, context);
    }

    @Test
    void vet_noCheckApplies_allowed() {
        // setup
        when(firstCheck.appliesTo(command)).thenReturn(false);
        when(secondCheck.appliesTo(command)).thenReturn(false);

        // execution
        NatsVerdict verdict = vetter.vet(command, context).block();

        // verifications
        assertThat(verdict).isEqualTo(NatsVerdict.ALLOWED);
    }

    @Test
    void vet_malformedCommand_protocolTroubleWithoutAskingTheChecks() {
        // setup
        byte[] raw = "PUB x abc\r\n".getBytes(UTF_8);
        NatsClientCommand malformed = NatsClientCommand.malformed(raw, "PUB payload size is not a number");

        // execution
        NatsVerdict verdict = vetter.vet(malformed, context).block();

        // verifications
        assertThat(verdict).isEqualTo(new NatsVerdict.ProtocolTrouble("PUB payload size is not a number"));
        verify(firstCheck, never()).appliesTo(malformed);
    }

    @Test
    void vet_checkFindsUnparsableBody_protocolTrouble() {
        // setup
        when(firstCheck.appliesTo(command)).thenReturn(true);
        when(firstCheck.check(command, context)).thenReturn(Mono.error(new NatsProtocolException("CONNECT options are not JSON")));

        // execution
        NatsVerdict verdict = vetter.vet(command, context).block();

        // verifications
        assertThat(verdict).isEqualTo(new NatsVerdict.ProtocolTrouble("CONNECT options are not JSON"));
    }
}
