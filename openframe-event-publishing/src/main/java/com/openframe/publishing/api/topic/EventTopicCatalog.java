package com.openframe.publishing.api.topic;

import com.openframe.publishing.registry.AggregateSpecRegistry;
import lombok.RequiredArgsConstructor;

import java.util.List;
import java.util.stream.Stream;

// The one place that names a published type's topic and DLT; management creates them from here, the stream checks them.
@RequiredArgsConstructor
public class EventTopicCatalog {

    private static final String DEAD_LETTER_SUFFIX = "-dlt";

    private final AggregateSpecRegistry specRegistry;

    public static String topicOf(String topicPrefix, String typeName) {
        return topicPrefix + typeName;
    }

    public static String deadLetterTopicOf(String topic) {
        return topic + DEAD_LETTER_SUFFIX;
    }

    // Every spec, whatever its switches: an empty topic costs nothing, and a type can then be switched on in any order.
    public List<EventTopicDefinition> findAllTopics(String topicPrefix) {
        return specRegistry.types().stream()
                .sorted()
                .map(typeName -> topicOf(topicPrefix, typeName))
                .flatMap(EventTopicCatalog::withItsDeadLetterTopic)
                .toList();
    }

    private static Stream<EventTopicDefinition> withItsDeadLetterTopic(String topic) {
        String deadLetterTopic = deadLetterTopicOf(topic);
        EventTopicDefinition events = EventTopicDefinition.events(topic);
        EventTopicDefinition deadLetter = EventTopicDefinition.deadLetter(deadLetterTopic);
        return Stream.of(events, deadLetter);
    }
}
