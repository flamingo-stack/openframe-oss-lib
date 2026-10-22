package com.openframe.publishing.config;

import com.openframe.publishing.registry.AggregateSpecRegistry;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.context.annotation.Import;

// Without the publish switch: processing and reconciliation read the specs too, and may run with publishing off.
@AutoConfiguration
@ConditionalOnBooleanProperty(name = "spring.data.mongodb.enabled")
@Import(AggregateSpecRegistry.class)
public class AggregateSpecAutoConfiguration {
}
