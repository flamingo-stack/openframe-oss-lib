package com.openframe.processing.config;

import com.openframe.processing.config.properties.EventProcessingKafkaProperties;
import com.openframe.processing.config.properties.ProcessingModeProperties;
import com.openframe.processing.mode.ProcessingModes;
import com.openframe.processing.runner.EventProcessingMetrics;
import com.openframe.processing.runner.ProjectionRunner;
import com.openframe.publishing.config.AggregateSpecAutoConfiguration;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Import;

// Listed, not scanned (the projections come from the services' spec beans); off by default, so no listener runs before its topic exists.
@AutoConfiguration(after = AggregateSpecAutoConfiguration.class)
@ConditionalOnBooleanProperty(name = "openframe.events.processing.enabled")
@EnableConfigurationProperties({ProcessingModeProperties.class, EventProcessingKafkaProperties.class})
@Import({ProcessingModes.class, ProcessingModeStartupCheck.class, ProjectionRunner.class, EventProcessingMetrics.class})
public class EventProcessingAutoConfiguration {
}
