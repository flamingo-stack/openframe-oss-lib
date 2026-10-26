package com.openframe.processing.listener;

import com.openframe.processing.config.properties.EventProcessingKafkaProperties;
import com.openframe.processing.runner.ProjectionRunner;
import com.openframe.processing.topic.EventTopicNames;
import com.openframe.publishing.api.PublishedDocuments;
import com.openframe.publishing.api.spec.AggregateSpec;
import com.openframe.publishing.config.PublishedAggregateTopics;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import org.springframework.kafka.annotation.KafkaListenerConfigurer;
import org.springframework.kafka.config.KafkaListenerContainerFactory;
import org.springframework.kafka.config.KafkaListenerEndpointRegistrar;
import tools.jackson.databind.json.JsonMapper;

// One listener per published type with a spec, on <topic-prefix><type> in the group <group-prefix><type>; a new spec needs no listener class.
public class PublishedEventListeners implements KafkaListenerConfigurer {

    private static final String LISTENER_ID_PREFIX = "event-processing-";

    private final AggregateSpecRegistry specRegistry;
    private final ProjectionRunner runner;
    private final EventProcessingKafkaProperties properties;
    private final JsonMapper envelopeMapper;
    private final KafkaListenerContainerFactory<?> containerFactory;
    private final PublishedAggregateTopics publishedTopics;

    public PublishedEventListeners(AggregateSpecRegistry specRegistry, ProjectionRunner runner,
                                   EventProcessingKafkaProperties properties, JsonMapper envelopeMapper,
                                   KafkaListenerContainerFactory<?> containerFactory, PublishedAggregateTopics publishedTopics) {
        this.specRegistry = specRegistry;
        this.publishedTopics = publishedTopics;
        this.runner = runner;
        this.properties = properties;
        this.envelopeMapper = envelopeMapper;
        this.containerFactory = containerFactory;
    }

    @Override
    public void configureKafkaListeners(KafkaListenerEndpointRegistrar registrar) {
        EventProcessingKafkaProperties.Kafka kafka = properties.getKafka();
        String topicPrefix = EventTopicNames.requireTopicPrefix(kafka);
        String groupPrefix = EventTopicNames.requireGroupPrefix(kafka);
        for (AggregateSpec<?, ?> spec : specRegistry.specs()) {
            String type = spec.getType();
            // A type nobody publishes has no topic, so no listener either.
            if (!publishedTopics.isPublishing(type)) {
                continue;
            }
            Class<?> eventClass = PublishedDocuments.resolveEventClass(spec);
            PublishedTypeListener listener = new PublishedTypeListener(type, eventClass, envelopeMapper, runner);
            String topic = EventTopicNames.topicOf(topicPrefix, type);
            PublishedTypeEndpoint endpoint = new PublishedTypeEndpoint(LISTENER_ID_PREFIX + type, groupPrefix + type, topic,
                    listener);
            registrar.registerEndpoint(endpoint, containerFactory);
        }
    }
}
