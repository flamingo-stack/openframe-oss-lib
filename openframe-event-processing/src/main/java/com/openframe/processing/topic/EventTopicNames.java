package com.openframe.processing.topic;

import com.openframe.processing.config.properties.EventProcessingKafkaProperties;

// The one place that names a published type's topic and its DLT; the listeners, the DLT recoverer and the topic creator use it.
public final class EventTopicNames {

    private static final String DEAD_LETTER_SUFFIX = "-dlt";

    private EventTopicNames() {
    }

    public static String topicOf(String topicPrefix, String typeName) {
        return topicPrefix + typeName;
    }

    public static String deadLetterTopicOf(String topic) {
        return topic + DEAD_LETTER_SUFFIX;
    }

    // No default: a service must name its topics, and the dev shareds on one Kafka cluster must not share one.
    public static String requireTopicPrefix(EventProcessingKafkaProperties.Kafka kafka) {
        return required(kafka.getTopicPrefix(), "topic-prefix");
    }

    public static String requireGroupPrefix(EventProcessingKafkaProperties.Kafka kafka) {
        return required(kafka.getGroupPrefix(), "group-prefix");
    }

    private static String required(String value, String key) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("openframe.events.processing.kafka." + key + " is required when event processing or topic creation is on");
        }
        return value;
    }
}
