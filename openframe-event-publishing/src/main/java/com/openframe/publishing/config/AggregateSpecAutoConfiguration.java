package com.openframe.publishing.config;

import com.openframe.publishing.registry.AggregateSpecRegistry;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Import;

// Without the publish switch: the stream reads the specs and the per-type publish switches with publishing off too.
@AutoConfiguration
@ConditionalOnBooleanProperty(name = "spring.data.mongodb.enabled")
@EnableConfigurationProperties(EventsProperties.class)
@Import({AggregateSpecRegistry.class, PublishedAggregateTopics.class})
public class AggregateSpecAutoConfiguration {
}
