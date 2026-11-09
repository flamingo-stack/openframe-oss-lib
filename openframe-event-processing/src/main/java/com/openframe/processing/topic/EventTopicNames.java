package com.openframe.processing.topic;

import com.openframe.processing.config.properties.EventProcessingKafkaProperties;
import com.openframe.publishing.api.topic.EventTopicCatalog;

// The names the listeners, the DLT recoverer and the topic check use; topic names come from EventTopicCatalog, which management creates them from.
public final class EventTopicNames {

    private EventTopicNames() {
    }

    public static String topicOf(String topicPrefix, String typeName) {
        return EventTopicCatalog.topicOf(topicPrefix, typeName);
    }

    // <type>.<projection>: the listener's id and group suffix; a type has no dot, so two never collide.
    public static String buildListenerName(String typeName, String projectionName) {
        return typeName + "." + projectionName;
    }

    public static String deadLetterTopicOf(String topic) {
        return EventTopicCatalog.deadLetterTopicOf(topic);
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
            throw new IllegalStateException("openframe.events.processing.kafka." + key + " is required when event processing or the topic check is on");
        }
        return value;
    }
}
