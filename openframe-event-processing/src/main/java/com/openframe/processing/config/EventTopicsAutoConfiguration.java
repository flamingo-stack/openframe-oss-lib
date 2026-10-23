package com.openframe.processing.config;

import com.openframe.processing.config.properties.EventProcessingKafkaProperties;
import com.openframe.processing.topic.EventTopicCreator;
import com.openframe.publishing.config.AggregateSpecAutoConfiguration;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;

// Only with processing on: off means no infrastructure, so processing is switched on (all on aspect) before the connector.
@AutoConfiguration(after = AggregateSpecAutoConfiguration.class)
@ConditionalOnBooleanProperty(name = {"openframe.events.processing.enabled", "openframe.events.processing.kafka.topics.create"})
@EnableConfigurationProperties(EventProcessingKafkaProperties.class)
public class EventTopicsAutoConfiguration {

    @Bean
    public EventTopicCreator eventTopicCreator(AggregateSpecRegistry specRegistry, EventProcessingKafkaProperties properties) {
        return new EventTopicCreator(specRegistry, properties);
    }
}
