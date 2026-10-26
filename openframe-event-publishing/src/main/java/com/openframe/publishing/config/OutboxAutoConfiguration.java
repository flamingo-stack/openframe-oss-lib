package com.openframe.publishing.config;

import com.openframe.publishing.api.OutboxPublisher;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import com.openframe.publishing.repository.PublishingRepositoryPostProcessor;
import com.openframe.publishing.repository.PublishingRepositoryStartupCheck;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;

// Listed, not scanned (the specs are the services' own beans); switched off, every repository is plain Spring Data.
@AutoConfiguration(after = AggregateSpecAutoConfiguration.class)
@ConditionalOnBooleanProperty(name = {"spring.data.mongodb.enabled", "openframe.events.enabled"})
@Import({EventsConfiguration.class, PublishedAggregateTopics.class, PublishedAggregateStartupCheck.class, OutboxPublisher.class,
        PublishingRepositoryStartupCheck.class})
public class OutboxAutoConfiguration {

    // Static: a BeanPostProcessor must not wait for its configuration class.
    @Bean
    public static PublishingRepositoryPostProcessor publishingRepositoryPostProcessor(
            ObjectProvider<AggregateSpecRegistry> specRegistry, ObjectProvider<OutboxPublisher> outboxPublisher) {
        return new PublishingRepositoryPostProcessor(specRegistry, outboxPublisher);
    }
}
