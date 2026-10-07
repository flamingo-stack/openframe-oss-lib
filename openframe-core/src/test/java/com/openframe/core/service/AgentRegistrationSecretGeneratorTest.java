package com.openframe.core.service;

import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AgentRegistrationSecretGeneratorTest {

    private final AgentRegistrationSecretGenerator generator = new AgentRegistrationSecretGenerator();

    @Test
    void generatesAlphanumericKeysOfFixedLength() {
        for (int i = 0; i < 10_000; i++) {
            String key = generator.generate();
            assertEquals(32, key.length());
            assertTrue(key.matches("[A-Za-z0-9]+"), "unexpected character in " + key);
        }
    }

    @Test
    void generatesDistinctKeys() {
        Set<String> keys = new HashSet<>();
        for (int i = 0; i < 1_000; i++) {
            keys.add(generator.generate());
        }
        assertEquals(1_000, keys.size());
    }
}
