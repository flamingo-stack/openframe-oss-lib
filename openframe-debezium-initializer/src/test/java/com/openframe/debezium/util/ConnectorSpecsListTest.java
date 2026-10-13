package com.openframe.debezium.util;

import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ConnectorSpecsListTest {

    @Test
    void listOf_commaSeparatedWithBlanks_trimmedItemsOnly() {
        // setup
        Map<String, Object> config = Map.of("signal.enabled.channels", " source, ,kafka ,");

        // execution
        List<String> channels = ConnectorSpecs.listOf(config, "signal.enabled.channels");

        // verifications
        assertThat(channels).containsExactly("source", "kafka");
    }

    @Test
    void listOf_keyMissing_empty() {
        // setup
        Map<String, Object> config = new HashMap<>();

        // execution
        List<String> channels = ConnectorSpecs.listOf(config, "signal.enabled.channels");

        // verifications
        assertThat(channels).isEmpty();
    }
}
