package com.openframe.publishing.config;

import com.openframe.publishing.persistence.OutboxIndexInitializer;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.context.annotation.Import;

// Apart from OutboxAutoConfiguration, so a context without a Mongo server can load the rest.
@AutoConfiguration
@ConditionalOnBooleanProperty(name = {"spring.data.mongodb.enabled", "openframe.events.enabled"})
@Import(OutboxIndexInitializer.class)
public class OutboxIndexAutoConfiguration {
}
