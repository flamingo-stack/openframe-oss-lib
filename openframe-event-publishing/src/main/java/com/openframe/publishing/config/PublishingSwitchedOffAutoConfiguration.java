package com.openframe.publishing.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.boot.context.properties.bind.Bindable;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.core.env.Environment;

import java.util.Map;

// With the module switched off, a topic's publish: true publishes nothing; this says so at startup instead of staying silent.
@Slf4j
@AutoConfiguration
@ConditionalOnBooleanProperty(name = "openframe.events.publishing.enabled", havingValue = false, matchIfMissing = true)
public class PublishingSwitchedOffAutoConfiguration implements SmartInitializingSingleton {

    private static final String TOPICS_PREFIX = "openframe.events.topics";

    private final Environment environment;

    public PublishingSwitchedOffAutoConfiguration(Environment environment) {
        this.environment = environment;
    }

    @Override
    public void afterSingletonsInstantiated() {
        Binder binder = Binder.get(environment);
        Bindable<Map<String, EventsProperties.Topic>> topicsType = Bindable.mapOf(String.class, EventsProperties.Topic.class);
        Map<String, EventsProperties.Topic> topics = binder.bind(TOPICS_PREFIX, topicsType).orElse(Map.of());
        topics.forEach((type, topic) -> {
            if (topic.isPublish()) {
                log.warn("{}.{}.publish is true, but openframe.events.publishing.enabled is off, so nothing is published",
                        TOPICS_PREFIX, type);
            }
        });
    }
}
