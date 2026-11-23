package com.openframe.gateway.config.ws.nats.validation;

import com.openframe.gateway.config.ws.nats.NatsClientContext;
import com.openframe.gateway.config.ws.nats.NatsTestCommands;
import com.openframe.gateway.config.ws.nats.NatsTestContexts;
import com.openframe.gateway.config.ws.nats.protocol.NatsClientCommand;
import com.openframe.gateway.config.ws.nats.protocol.NatsOperation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PublishSubjectValidatorTest {

    private NatsClientContext context;
    private PublishSubjectValidator validator;

    @BeforeEach
    void setUp() {
        context = NatsTestContexts.device();
        validator = new PublishSubjectValidator();
    }

    @Test
    void appliesTo_publishAndHeaderPublish_true() {
        // setup
        NatsClientCommand publish = NatsTestCommands.publish("machine.m-1.heartbeat", "hi");
        NatsClientCommand headerPublish = NatsTestCommands.command("HPUB machine.m-1.hostname 12 17\r\nNATS/1.0\r\n\r\nhello\r\n");

        // execution
        boolean appliesToPublish = validator.appliesTo(publish);
        boolean appliesToHeaderPublish = validator.appliesTo(headerPublish);

        // verifications
        assertThat(appliesToPublish).isTrue();
        assertThat(appliesToHeaderPublish).isTrue();
    }

    @Test
    void appliesTo_subscribe_false() {
        // setup
        NatsClientCommand command = NatsTestCommands.command("SUB machine.m-1.x 1\r\n");

        // execution
        boolean applies = validator.appliesTo(command);

        // verifications
        assertThat(applies).isFalse();
    }

    @Test
    void check_ownMachineSubject_allowed() {
        // setup
        NatsClientCommand command = NatsTestCommands.publish("machine.m-1.heartbeat", "hi");

        // execution
        NatsValidationResult result = validator.validate(command, context).block();

        // verifications
        assertThat(result).isEqualTo(NatsValidationResult.ALLOWED);
    }

    @Test
    void check_foreignMachineHeaderPublish_refusedWithOperationAndSubject() {
        // setup
        NatsClientCommand command = NatsTestCommands.command("HPUB machine.m-2.cmd 12 17\r\nNATS/1.0\r\n\r\nhello\r\n");

        // execution
        NatsValidationResult result = validator.validate(command, context).block();

        // verifications
        assertThat(result).isEqualTo(new NatsValidationResult.Refused(NatsOperation.HPUB, "machine.m-2.cmd"));
    }
}
