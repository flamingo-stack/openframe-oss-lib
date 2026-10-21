package com.openframe.processing.config;

import com.openframe.processing.config.properties.EventProcessingKafkaProperties;
import com.openframe.processing.config.properties.ProcessingModeProperties;
import com.openframe.processing.mode.ProcessingModes;
import com.openframe.processing.registry.EventProcessorRegistry;
import com.openframe.processing.runner.EventProcessingMetrics;
import com.openframe.processing.runner.EventProcessorRunner;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Import;

// Listed, not scanned (the processors are the services' own beans); off by default, so no listener runs before its topic exists.
@AutoConfiguration
@ConditionalOnBooleanProperty(name = "openframe.events.processing.enabled")
@EnableConfigurationProperties({ProcessingModeProperties.class, EventProcessingKafkaProperties.class})
@Import({ProcessingModes.class, EventProcessorRegistry.class, EventProcessorStartupCheck.class,
        EventProcessorRunner.class, EventProcessingMetrics.class})
public class EventProcessingAutoConfiguration {
}
