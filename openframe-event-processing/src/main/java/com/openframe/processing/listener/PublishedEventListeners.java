package com.openframe.processing.listener;

import com.openframe.processing.config.properties.EventProcessingKafkaProperties;
import com.openframe.processing.runner.ProjectionRunner;
import com.openframe.processing.topic.EventTopicNames;
import com.openframe.publishing.api.PublishedDocuments;
import com.openframe.publishing.api.spec.AggregateSpec;
import com.openframe.publishing.api.spec.Projection;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import org.springframework.kafka.annotation.KafkaListenerConfigurer;
import org.springframework.kafka.config.KafkaListenerContainerFactory;
import org.springframework.kafka.config.KafkaListenerEndpointRegistrar;
import tools.jackson.databind.json.JsonMapper;

// One listener per projection of a published type, on <topic-prefix><type> in the group <group-prefix><type>.<projection>; no listener class to write.
public class PublishedEventListeners implements KafkaListenerConfigurer {

    private static final String LISTENER_ID_PREFIX = "event-processing-";

    private final AggregateSpecRegistry specRegistry;
    private final ProjectionRunner runner;
    private final EventProcessingKafkaProperties properties;
    private final JsonMapper envelopeMapper;
    private final KafkaListenerContainerFactory<?> containerFactory;

    public PublishedEventListeners(AggregateSpecRegistry specRegistry, ProjectionRunner runner,
                                   EventProcessingKafkaProperties properties, JsonMapper envelopeMapper,
                                   KafkaListenerContainerFactory<?> containerFactory) {
        this.specRegistry = specRegistry;
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
            Class<?> eventClass = PublishedDocuments.resolveEventClass(spec);
            String topic = EventTopicNames.topicOf(topicPrefix, type);
            for (Projection<?, ?> projection : spec.projections()) {
                String listenerName = EventTopicNames.buildListenerName(type, projection.name());
                ProjectionListener listener = new ProjectionListener(type, projection, eventClass, envelopeMapper, runner);
                ProjectionEndpoint endpoint = new ProjectionEndpoint(LISTENER_ID_PREFIX + listenerName,
                        groupPrefix + listenerName, topic, listener);
                registrar.registerEndpoint(endpoint, containerFactory);
            }
        }
    }
}
