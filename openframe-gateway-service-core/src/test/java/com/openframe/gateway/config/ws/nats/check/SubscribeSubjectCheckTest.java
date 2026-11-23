package com.openframe.gateway.config.ws.nats.check;

import com.openframe.gateway.config.ws.nats.NatsClientContext;
import com.openframe.gateway.config.ws.nats.NatsTestCommands;
import com.openframe.gateway.config.ws.nats.NatsTestContexts;
import com.openframe.gateway.config.ws.nats.protocol.NatsClientCommand;
import com.openframe.gateway.config.ws.nats.protocol.NatsOperation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SubscribeSubjectCheckTest {

    private NatsClientContext context;
    private SubscribeSubjectCheck check;

    @BeforeEach
    void setUp() {
        context = NatsTestContexts.device();
        check = new SubscribeSubjectCheck();
    }

    @Test
    void appliesTo_subscribe_true() {
        // setup
        NatsClientCommand command = NatsTestCommands.command("SUB machine.m-1.x 1\r\n");

        // execution
        boolean applies = check.appliesTo(command);

        // verifications
        assertThat(applies).isTrue();
    }

    @Test
    void appliesTo_publish_false() {
        // setup
        NatsClientCommand command = NatsTestCommands.publish("machine.m-1.heartbeat", "hi");

        // execution
        boolean applies = check.appliesTo(command);

        // verifications
        assertThat(applies).isFalse();
    }

    @Test
    void check_ownMachineSubject_allowed() {
        // setup
        NatsClientCommand command = NatsTestCommands.command("SUB machine.m-1.command-execution 1\r\n");

        // execution
        NatsVerdict verdict = check.check(command, context).block();

        // verifications
        assertThat(verdict).isEqualTo(NatsVerdict.ALLOWED);
    }

    @Test
    void check_foreignMachineSubject_refusedWithTheSubject() {
        // setup
        NatsClientCommand command = NatsTestCommands.command("SUB machine.m-2.command-execution 1\r\n");

        // execution
        NatsVerdict verdict = check.check(command, context).block();

        // verifications
        assertThat(verdict).isEqualTo(new NatsVerdict.Refused(NatsOperation.SUB, "machine.m-2.command-execution"));
    }
}
