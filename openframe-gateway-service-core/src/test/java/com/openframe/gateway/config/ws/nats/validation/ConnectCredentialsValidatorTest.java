package com.openframe.gateway.config.ws.nats.validation;

import com.openframe.gateway.config.ws.nats.NatsClientContext;
import com.openframe.gateway.config.ws.nats.NatsTestCommands;
import com.openframe.gateway.config.ws.nats.NatsTestContexts;
import com.openframe.gateway.config.ws.nats.protocol.NatsClientCommand;
import com.openframe.gateway.config.ws.nats.protocol.NatsConnectOptionsParser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;

class ConnectCredentialsValidatorTest {

    private static final String CONNECT_DEVICE_USER = "CONNECT {\"user\":\"machine\",\"pass\":\"\"}\r\n";
    private static final String CONNECT_WITH_PASSWORD = "CONNECT {\"user\":\"service\",\"pass\":\"secret\"}\r\n";

    private NatsClientContext context;
    private ConnectCredentialsValidator validator;

    @BeforeEach
    void setUp() {
        context = NatsTestContexts.device();
        validator = new ConnectCredentialsValidator(new NatsConnectOptionsParser(new ObjectMapper()));
    }

    @Test
    void appliesTo_connect_true() {
        // setup
        NatsClientCommand command = NatsTestCommands.command(CONNECT_DEVICE_USER);

        // execution
        boolean applies = validator.appliesTo(command);

        // verifications
        assertThat(applies).isTrue();
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
    void check_deviceUserWithoutCredential_allowed() {
        // setup
        NatsClientCommand command = NatsTestCommands.command(CONNECT_DEVICE_USER);

        // execution
        NatsValidationResult result = validator.validate(command, context).block();

        // verifications
        assertThat(result).isEqualTo(NatsValidationResult.ALLOWED);
    }

    @Test
    void check_connectWithPassword_closedNamingTheField() {
        // setup
        NatsClientCommand command = NatsTestCommands.command(CONNECT_WITH_PASSWORD);

        // execution
        NatsValidationResult result = validator.validate(command, context).block();

        // verifications
        assertThat(result).isEqualTo(new NatsValidationResult.CloseSession("CONNECT carries pass"));
    }
}
