package com.openframe.gateway.config.ws.nats.jetstream;

import com.openframe.gateway.config.ws.nats.NatsClientContext;
import com.openframe.gateway.config.ws.nats.NatsTestContexts;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class SubjectPolicyConsumerAuthorizerTest {

    private static final String TIMEZONE_STREAM = "MACHINE_TIMEZONE_REQUEST";
    private static final String CHAT_STREAM = "CHAT_CHUNKS";

    private SubjectPolicyConsumerAuthorizer authorizer;

    @BeforeEach
    void setUp() {
        authorizer = new SubjectPolicyConsumerAuthorizer();
    }

    @Test
    void supports_anyStream_true() {
        // execution
        boolean supported = authorizer.supports(CHAT_STREAM);

        // verifications
        assertThat(supported).isTrue();
    }

    @Test
    void mayConsume_deviceFiltersOnItsOwnMachine_true() {
        // setup
        NatsClientContext context = NatsTestContexts.device();
        ConsumerCreateRequest request = request(TIMEZONE_STREAM, "machine.m-1.timezone.request");

        // execution
        Boolean allowed = authorizer.mayConsume(context, request).block();

        // verifications
        assertThat(allowed).isTrue();
    }

    @Test
    void mayConsume_deviceFiltersOnAnotherMachine_false() {
        // setup
        NatsClientContext context = NatsTestContexts.device();
        ConsumerCreateRequest request = request(TIMEZONE_STREAM, "machine.m-2.timezone.request");

        // execution
        Boolean allowed = authorizer.mayConsume(context, request).block();

        // verifications
        assertThat(allowed).isFalse();
    }

    @Test
    void mayConsume_userFiltersOnAChatDialog_true() {
        // setup
        NatsClientContext context = NatsTestContexts.user();
        ConsumerCreateRequest request = request(CHAT_STREAM, "chat.d-1.message");

        // execution
        Boolean allowed = authorizer.mayConsume(context, request).block();

        // verifications
        assertThat(allowed).isTrue();
    }

    @Test
    void mayConsume_deviceFiltersOnAChatDialog_falseWithoutAStreamRule() {
        // setup
        NatsClientContext context = NatsTestContexts.device();
        ConsumerCreateRequest request = request(CHAT_STREAM, "chat.d-1.message");

        // execution
        Boolean allowed = authorizer.mayConsume(context, request).block();

        // verifications
        assertThat(allowed).isFalse();
    }

    @Test
    void mayConsume_oneFilterOutsideThePolicy_false() {
        // setup
        NatsClientContext context = NatsTestContexts.user();
        ConsumerCreateRequest request = new ConsumerCreateRequest(CHAT_STREAM,
                List.of("chat.d-1.message", "machine.m-1.heartbeat"), Optional.empty());

        // execution
        Boolean allowed = authorizer.mayConsume(context, request).block();

        // verifications
        assertThat(allowed).isFalse();
    }

    @Test
    void mayConsume_unfilteredConsumer_false() {
        // setup
        NatsClientContext context = NatsTestContexts.user();
        ConsumerCreateRequest request = new ConsumerCreateRequest(CHAT_STREAM, List.of(), Optional.empty());

        // execution
        Boolean allowed = authorizer.mayConsume(context, request).block();

        // verifications
        assertThat(allowed).isFalse();
    }

    private static ConsumerCreateRequest request(String stream, String filterSubject) {
        return new ConsumerCreateRequest(stream, List.of(filterSubject), Optional.empty());
    }
}
