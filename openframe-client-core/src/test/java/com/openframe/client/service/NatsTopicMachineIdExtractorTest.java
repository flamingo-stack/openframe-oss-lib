package com.openframe.client.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Extracts the machineId (2nd segment) from a {@code machine.<id>.<suffix>} NATS
 * subject — the routing key for the command-result path.
 */
class NatsTopicMachineIdExtractorTest {

    private final NatsTopicMachineIdExtractor extractor = new NatsTopicMachineIdExtractor();

    @Test
    @DisplayName("extracts the machineId from a valid subject (any suffix length)")
    void extractsMachineId() {
        assertThat(extractor.extract("machine.abc-123.command-execution.result")).isEqualTo("abc-123");
        assertThat(extractor.extract("machine.m1.heartbeat")).isEqualTo("m1");
    }

    @Test
    @DisplayName("null or empty subject is rejected")
    void rejectsNullOrEmpty() {
        assertThatThrownBy(() -> extractor.extract(null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> extractor.extract("")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("subject not starting with 'machine' is rejected")
    void rejectsWrongPrefix() {
        assertThatThrownBy(() -> extractor.extract("device.m1.heartbeat"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid NATS subject");
    }

    @Test
    @DisplayName("subject with fewer than 3 segments is rejected")
    void rejectsTooFewParts() {
        assertThatThrownBy(() -> extractor.extract("machine.m1"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid NATS subject");
    }

    @Test
    @DisplayName("blank machineId segment is rejected")
    void rejectsEmptyMachineId() {
        assertThatThrownBy(() -> extractor.extract("machine..result"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Machine ID is empty");
    }
}
