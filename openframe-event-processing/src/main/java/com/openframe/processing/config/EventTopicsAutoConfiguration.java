package com.openframe.processing.config;

import com.openframe.processing.config.properties.EventProcessingKafkaProperties;
import com.openframe.processing.topic.EventTopicCreator;
import com.openframe.publishing.config.AggregateSpecAutoConfiguration;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;

// Apart from the processing switch: the topics must exist before the connector writes, which can be before processing is on.
@AutoConfiguration(after = AggregateSpecAutoConfiguration.class)
@ConditionalOnBooleanProperty(name = "openframe.events.processing.kafka.topics.create")
@EnableConfigurationProperties(EventProcessingKafkaProperties.class)
public class EventTopicsAutoConfiguration {

    @Bean
    public EventTopicCreator eventTopicCreator(AggregateSpecRegistry specRegistry, EventProcessingKafkaProperties properties) {
        return new EventTopicCreator(specRegistry, properties);
    }
}
