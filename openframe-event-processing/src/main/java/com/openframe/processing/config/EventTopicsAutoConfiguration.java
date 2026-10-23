package com.openframe.processing.config;

import com.openframe.processing.config.properties.EventProcessingKafkaProperties;
import com.openframe.processing.topic.EventTopicCreator;
import com.openframe.publishing.config.AggregateSpecAutoConfiguration;
import com.openframe.publishing.config.PublishedAggregateTopics;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;

// The stream creates a type's topics when the type is switched on there, before the tenant services publish it.
@AutoConfiguration(after = AggregateSpecAutoConfiguration.class)
@ConditionalOnBooleanProperty(name = "openframe.events.enabled")
@EnableConfigurationProperties(EventProcessingKafkaProperties.class)
public class EventTopicsAutoConfiguration {

    @Bean
    public EventTopicCreator eventTopicCreator(AggregateSpecRegistry specRegistry, PublishedAggregateTopics publishedTopics,
                                               EventProcessingKafkaProperties properties) {
        return new EventTopicCreator(specRegistry, publishedTopics, properties);
    }
}
