package com.openframe.debezium.recovery.gap;

import tools.jackson.databind.ObjectMapper;
import lombok.Getter;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public class IncrementalSnapshotSignal {

    private static final String SIGNAL_TYPE = "execute-snapshot";
    private static final String SNAPSHOT_TYPE = "INCREMENTAL";

    @Getter
    private final String id = UUID.randomUUID().toString();
    private final List<SnapshotCondition> conditions;

    public IncrementalSnapshotSignal(List<SnapshotCondition> conditions) {
        this.conditions = List.copyOf(conditions);
    }

    public String toJson(ObjectMapper objectMapper) {
        Map<String, Object> signal = new LinkedHashMap<>();
        signal.put("id", id);
        signal.put("type", SIGNAL_TYPE);
        signal.put("data", data());
        return objectMapper.writeValueAsString(signal);
    }

    private Map<String, Object> data() {
        List<String> dataCollections = conditions.stream().map(SnapshotCondition::getDataCollection).toList();
        List<Map<String, String>> additionalConditions = conditions.stream()
                .filter(SnapshotCondition::isFiltered)
                .map(IncrementalSnapshotSignal::additionalCondition)
                .toList();
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("data-collections", dataCollections);
        data.put("type", SNAPSHOT_TYPE);
        data.put("additional-conditions", additionalConditions);
        return data;
    }

    private static Map<String, String> additionalCondition(SnapshotCondition condition) {
        Map<String, String> additional = new LinkedHashMap<>();
        additional.put("data-collection", condition.getDataCollection());
        additional.put("filter", condition.getFilter());
        return additional;
    }
}
