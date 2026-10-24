package com.openframe.processing.config;

import com.openframe.processing.config.properties.EventProcessingKafkaProperties;
import com.openframe.processing.config.properties.LargeUpdateProperties;
import com.openframe.processing.runner.EventProcessingMetrics;
import com.openframe.processing.runner.ProjectionRunner;
import com.openframe.processing.version.ProjectionVersionRepository;
import com.openframe.publishing.config.AggregateSpecAutoConfiguration;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.core.MongoOperations;

// Listed, not scanned (the projections come from the services' spec beans); off by default, so no listener runs before its topic exists.
@AutoConfiguration(after = AggregateSpecAutoConfiguration.class)
@ConditionalOnBooleanProperty(name = "openframe.events.enabled")
@EnableConfigurationProperties({EventProcessingKafkaProperties.class, LargeUpdateProperties.class})
@Import({ProjectionRunner.class, EventProcessingMetrics.class})
public class EventProcessingAutoConfiguration {

    // Missing-bean only for the tests that run without Mongo.
    @Bean
    @ConditionalOnMissingBean
    public ProjectionVersionRepository projectionVersionRepository(MongoOperations mongoOperations) {
        return new ProjectionVersionRepository(mongoOperations);
    }
}
