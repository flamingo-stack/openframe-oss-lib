package com.openframe.publishing.config;

import com.openframe.publishing.api.PublishedAggregateType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.core.env.Environment;

// With the module switched off, a topic's publish: true publishes nothing; this says so at startup instead of staying silent.
@Slf4j
@AutoConfiguration
@ConditionalOnBooleanProperty(name = "openframe.events.publishing.enabled", havingValue = false, matchIfMissing = true)
public class PublishingSwitchedOffAutoConfiguration implements SmartInitializingSingleton {

    private static final String PUBLISH_PROPERTY = "openframe.events.topics.%s.publish";

    private final Environment environment;

    public PublishingSwitchedOffAutoConfiguration(Environment environment) {
        this.environment = environment;
    }

    @Override
    public void afterSingletonsInstantiated() {
        for (PublishedAggregateType type : PublishedAggregateType.values()) {
            String name = type.getName();
            String property = PUBLISH_PROPERTY.formatted(name);
            boolean publish = environment.getProperty(property, Boolean.class, false);
            if (publish) {
                log.warn("{} is true, but openframe.events.publishing.enabled is off, so nothing is published", property);
            }
        }
    }
}
