package com.openframe.debezium.recovery.gap;

import com.openframe.debezium.dto.ConnectorOffsets;
import com.openframe.debezium.util.ConnectorSpecs;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

public abstract class SourceDialect {

    private static final String LIST_SEPARATOR = ",";

    public abstract String connectorClass();

    public abstract List<String> historyLostMarkers();

    public abstract List<SnapshotCondition> gapConditions(Map<String, Object> config,
                                                         Map<String, String> backfill,
                                                         Instant gapFrom);

    protected abstract String offsetTimeKey();

    protected abstract String partitionKey();

    // Offsets are keyed by topic.prefix; carried under another prefix they are ignored and the version starts from now.
    public boolean belongsTo(ConnectorOffsets offsets, Map<String, Object> config) {
        String topicPrefix = ConnectorSpecs.stringOf(config, ConnectorSpecs.KEY_TOPIC_PREFIX);
        List<Map<String, Object>> partitions = offsets.sourcePartitions();
        return !partitions.isEmpty() && partitions.stream()
                .allMatch(partition -> topicPrefix.equals(partition.get(partitionKey())));
    }

    public boolean hasSourceTime(ConnectorOffsets offsets) {
        return offsets.sourceOffsets().stream()
                .anyMatch(offset -> offset.get(offsetTimeKey()) instanceof Number);
    }

    public Instant sourceTime(ConnectorOffsets offsets) {
        long latestSecond = offsets.sourceOffsets().stream()
                .map(offset -> offset.get(offsetTimeKey()))
                .filter(Number.class::isInstance)
                .mapToLong(value -> ((Number) value).longValue())
                .max()
                .orElseThrow();
        return Instant.ofEpochSecond(latestSecond);
    }

    protected static List<String> splitList(String value) {
        return Arrays.stream(value.split(LIST_SEPARATOR))
                .map(String::trim)
                .filter(item -> !item.isEmpty())
                .toList();
    }
}
