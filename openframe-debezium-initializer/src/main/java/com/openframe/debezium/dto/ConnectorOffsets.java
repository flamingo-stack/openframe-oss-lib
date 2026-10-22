package com.openframe.debezium.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ConnectorOffsets {

    private static final String KEY_OFFSET = "offset";
    private static final String KEY_PARTITION = "partition";

    private List<Map<String, Object>> offsets = new ArrayList<>();

    public static ConnectorOffsets empty() {
        return new ConnectorOffsets();
    }

    // Kafka Connect rejects unknown fields in a PATCH body, so derived getters must stay off the wire.
    @JsonIgnore
    public boolean isEmpty() {
        return offsets == null || offsets.isEmpty();
    }

    @JsonIgnore
    public List<Map<String, Object>> sourceOffsets() {
        return entriesOf(KEY_OFFSET);
    }

    @JsonIgnore
    public List<Map<String, Object>> sourcePartitions() {
        return entriesOf(KEY_PARTITION);
    }

    private List<Map<String, Object>> entriesOf(String key) {
        if (isEmpty()) return List.of();
        return offsets.stream()
                .map(entry -> entry.get(key))
                .filter(Map.class::isInstance)
                .map(ConnectorOffsets::asOffsetMap)
                .toList();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> asOffsetMap(Object value) {
        return (Map<String, Object>) value;
    }
}
