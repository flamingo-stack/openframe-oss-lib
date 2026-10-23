package com.openframe.processing.config.properties;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.kafka.autoconfigure.KafkaProperties;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;

// The processor listeners' own Kafka settings, apart from the service's other clusters (spring.kafka, spring.saas.kafka).
@Getter
@ConfigurationProperties(prefix = "openframe.events.processing")
public class EventProcessingKafkaProperties {

    private final Kafka kafka = new Kafka();

    // Spring's Kafka keys plus our back-off; nested, as a second KafkaProperties bean breaks Spring's own.
    @Getter
    @Setter
    public static class Kafka extends KafkaProperties {

        // A new group starts at the oldest record of the compacted topic, so it sees the latest event of every aggregate.
        private static final String FROM_OLDEST_RECORD = "earliest";
        // Small: a record waiting behind a slow one waits for at most this many.
        private static final int MAX_POLL_RECORDS = 20;

        // No defaults: read by the listeners' placeholders, which fail at startup when they are missing.
        private String topicPrefix;
        // Per service, for example ${spring.application.name}.processing-: two services in one group would split the events.
        private String groupPrefix;

        // Not "retry": KafkaProperties already has a retry section, for retry topics.
        private final BackOff backOff = new BackOff();

        private final Topics topics = new Topics();

        public Kafka() {
            // No localhost:9092 default: a service that turns processing on must name the cluster, like the prefixes.
            setBootstrapServers(new ArrayList<>());
            getConsumer().setAutoOffsetReset(FROM_OLDEST_RECORD);
            getConsumer().setMaxPollRecords(MAX_POLL_RECORDS);
            // A topic that does not exist yet stops the start, instead of a listener that waits on nothing.
            getListener().setMissingTopicsFatal(true);
        }
    }

    // Every published type's topic and DLT, created at startup when create is on; the same settings for every type.
    @Getter
    @Setter
    public static class Topics {

        private static final long SEVEN_DAYS_MS = Duration.ofDays(7).toMillis();
        private static final long THIRTY_DAYS_MS = Duration.ofDays(30).toMillis();

        // Its own switch: the topics must exist before the connector writes, which can be before processing is on.
        private boolean create;
        // Compacted, so a new group reads the latest event of every aggregate; a delete stays readable for 7 days.
        private final TopicSettings events = new TopicSettings(Map.of(
                "cleanup.policy", "compact",
                "min.compaction.lag.ms", String.valueOf(SEVEN_DAYS_MS),
                "delete.retention.ms", String.valueOf(SEVEN_DAYS_MS)));
        private final TopicSettings deadLetter = new TopicSettings(Map.of(
                "cleanup.policy", "delete",
                "retention.ms", String.valueOf(THIRTY_DAYS_MS)));
    }

    // Used only when a topic is created; an existing topic is never changed.
    @Getter
    @Setter
    public static class TopicSettings {

        private int partitions = 1;
        private short replicationFactor = 2;
        private Map<String, String> config;

        TopicSettings(Map<String, String> defaultConfig) {
            this.config = new LinkedHashMap<>(defaultConfig);
        }
    }

    // The listeners' error handler retries only Mongo down: the wait doubles from initial-interval up to max-interval, no limit.
    @Getter
    @Setter
    public static class BackOff {

        private Duration initialInterval = Duration.ofSeconds(1);
        private double multiplier = 2.0;
        private Duration maxInterval = Duration.ofSeconds(30);
    }
}
