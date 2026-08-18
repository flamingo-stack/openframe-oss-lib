package com.openframe.data.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class PresencePropertiesTest {

    @Test
    void missing_ttl_fails_fast_on_startup() {
        PresenceProperties properties = new PresenceProperties();

        assertThrows(IllegalStateException.class, properties::afterPropertiesSet);
    }

    @Test
    void configured_ttl_passes() {
        PresenceProperties properties = new PresenceProperties();
        properties.setTtlSeconds(30);

        assertDoesNotThrow(properties::afterPropertiesSet);
    }
}
