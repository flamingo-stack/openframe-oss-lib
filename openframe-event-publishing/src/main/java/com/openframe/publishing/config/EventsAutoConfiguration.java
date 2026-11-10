package com.openframe.publishing.config;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Import;

// The switches in every service, Mongo or not: the aspects read them, and a service that publishes nothing reads them as off.
@AutoConfiguration
@EnableConfigurationProperties(EventsProperties.class)
@Import(PublishedAggregateTopics.class)
public class EventsAutoConfiguration {
}
