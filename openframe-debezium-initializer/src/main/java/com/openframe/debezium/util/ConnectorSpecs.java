package com.openframe.debezium.util;

import com.openframe.data.document.tool.IntegratedTool;

import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Stream;

/**
 * Helpers for working with the raw {@code Object[]} connector specs persisted
 * inside {@link IntegratedTool#getDebeziumConnectors()}. Centralises the cast
 * boilerplate so {@code @SuppressWarnings("unchecked")} lives in a single place
 * and null-handling stays consistent across callers.
 */
public final class ConnectorSpecs {

    public static final String KEY_NAME = "name";
    public static final String KEY_CONFIG = "config";

    private ConnectorSpecs() {
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> asMap(Object value) {
        if (!(value instanceof Map<?, ?>)) {
            return null;
        }
        return (Map<String, Object>) value;
    }

    public static String nameOf(Map<String, Object> spec) {
        if (spec == null) return null;
        Object name = spec.get(KEY_NAME);
        return name instanceof String s ? s : null;
    }

    public static Map<String, Object> configOf(Map<String, Object> spec) {
        return spec == null ? null : asMap(spec.get(KEY_CONFIG));
    }

    /**
     * Stream of non-null spec maps for one tool. Empty if the tool has no
     * connectors or the array entry is null / not a Map.
     */
    public static Stream<Map<String, Object>> specStreamOf(IntegratedTool tool) {
        Object[] connectors = tool == null ? null : tool.getDebeziumConnectors();
        if (connectors == null) return Stream.empty();
        return Arrays.stream(connectors)
                .map(ConnectorSpecs::asMap)
                .filter(Objects::nonNull);
    }

    /**
     * Shallow-copy of the given config map with {@code name} overridden. Null
     * config produces an empty map carrying just the name.
     */
    public static Map<String, Object> configWithName(Map<String, Object> config, String name) {
        Map<String, Object> copy = config == null ? new HashMap<>() : new HashMap<>(config);
        copy.put(KEY_NAME, name);
        return copy;
    }

    /**
     * Build the Kafka Connect connector-creation payload: {@code {name, config}}
     * where the inner config also carries {@code name} (Debezium requires the
     * name to match in both places).
     */
    public static Map<String, Object> connectorPayload(String name, Map<String, Object> config) {
        Map<String, Object> payload = new HashMap<>();
        payload.put(KEY_NAME, name);
        payload.put(KEY_CONFIG, configWithName(config, name));
        return payload;
    }
}
