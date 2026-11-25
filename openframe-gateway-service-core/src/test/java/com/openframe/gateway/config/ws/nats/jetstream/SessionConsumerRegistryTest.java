package com.openframe.gateway.config.ws.nats.jetstream;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SessionConsumerRegistryTest {

    private static final String STREAM = "CHAT_CHUNKS";
    private static final String CONSUMER = "c1";

    private SessionConsumerRegistry registry;

    @BeforeEach
    void setUp() {
        registry = new SessionConsumerRegistry();
    }

    @Test
    void isOwned_registeredConsumer_true() {
        // setup
        registry.register(STREAM, CONSUMER);

        // execution
        boolean owned = registry.isOwned(STREAM, CONSUMER);

        // verifications
        assertThat(owned).isTrue();
    }

    @Test
    void isOwned_neverRegistered_false() {
        // execution
        boolean owned = registry.isOwned(STREAM, CONSUMER);

        // verifications
        assertThat(owned).isFalse();
    }

    @Test
    void isOwned_sameNameOnAnotherStream_false() {
        // setup
        registry.register(STREAM, CONSUMER);

        // execution
        boolean owned = registry.isOwned("OTHER_STREAM", CONSUMER);

        // verifications
        assertThat(owned).isFalse();
    }
}
