package com.openframe.publishing.api.topic;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.Duration;
import java.util.Map;

// One topic of a published type, with the settings it must be created with; the creator applies them, nothing changes them later.
@Getter
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class EventTopicDefinition {

    private static final int PARTITIONS = 1;
    private static final String CLEANUP_POLICY = "cleanup.policy";
    private static final String COMPACT = "compact";
    private static final String DELETE = "delete";
    private static final String MIN_COMPACTION_LAG_MS = "min.compaction.lag.ms";
    private static final String DELETE_RETENTION_MS = "delete.retention.ms";
    private static final String RETENTION_MS = "retention.ms";
    private static final String SEVEN_DAYS_MS = String.valueOf(Duration.ofDays(7).toMillis());
    private static final String THIRTY_DAYS_MS = String.valueOf(Duration.ofDays(30).toMillis());

    private final String name;
    private final int partitions;
    private final Map<String, String> config;

    // Compacted, so a new consumer group reads the latest event of every aggregate; a delete stays readable for 7 days.
    // One partition: the events of an aggregate keep their order.
    public static EventTopicDefinition events(String name) {
        Map<String, String> config = Map.of(
                CLEANUP_POLICY, COMPACT,
                MIN_COMPACTION_LAG_MS, SEVEN_DAYS_MS,
                DELETE_RETENTION_MS, SEVEN_DAYS_MS);
        return new EventTopicDefinition(name, PARTITIONS, config);
    }

    public static EventTopicDefinition deadLetter(String name) {
        Map<String, String> config = Map.of(
                CLEANUP_POLICY, DELETE,
                RETENTION_MS, THIRTY_DAYS_MS);
        return new EventTopicDefinition(name, PARTITIONS, config);
    }
}
