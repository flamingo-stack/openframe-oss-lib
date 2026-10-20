package com.openframe.publishing.config;

import com.openframe.publishing.api.OutboxPublisher;
import com.openframe.publishing.repository.PublishedRepositorySpecs;
import com.openframe.publishing.repository.PublishingRepositoryPostProcessor;
import com.openframe.publishing.repository.PublishingRepositoryStartupCheck;
import com.openframe.publishing.spec.PublishedAggregateSpecRegistry;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;

// Listed, not scanned (the specs are the services' own beans); switched off, a PublishingMongoRepository is plain Spring Data.
@AutoConfiguration
@ConditionalOnBooleanProperty(name = {"spring.data.mongodb.enabled", "openframe.events.publishing.enabled"})
@Import({EventsConfiguration.class, PublishedAggregateTopics.class, PublishedAggregateSpecRegistry.class,
        PublishedAggregateStartupCheck.class, OutboxPublisher.class, PublishedRepositorySpecs.class,
        PublishingRepositoryStartupCheck.class})
public class OutboxAutoConfiguration {

    // Static: a BeanPostProcessor must not wait for its configuration class.
    @Bean
    public static PublishingRepositoryPostProcessor publishingRepositoryPostProcessor(
            ObjectProvider<PublishedRepositorySpecs> specs, ObjectProvider<OutboxPublisher> outboxPublisher) {
        return new PublishingRepositoryPostProcessor(specs, outboxPublisher);
    }
}
