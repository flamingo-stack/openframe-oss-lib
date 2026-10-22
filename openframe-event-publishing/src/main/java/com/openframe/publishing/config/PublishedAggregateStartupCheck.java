package com.openframe.publishing.config;

import com.openframe.publishing.registry.AggregateSpecRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.SmartInitializingSingleton;

import java.util.List;
import java.util.Map;
import java.util.Set;

// publish on for a type no spec covers would silently write nothing; refuse to start. Any other unknown key is only a WARN.
@Slf4j
@RequiredArgsConstructor
public class PublishedAggregateStartupCheck implements SmartInitializingSingleton {

    private final EventsProperties properties;
    private final AggregateSpecRegistry registry;

    @Override
    public void afterSingletonsInstantiated() {
        Map<String, EventsProperties.Topic> topics = properties.getTopics();
        Set<String> types = registry.types();
        List<String> publishedWithoutSpec = topics.entrySet().stream()
                .filter(entry -> entry.getValue().isPublish())
                .map(Map.Entry::getKey)
                .filter(type -> !types.contains(type))
                .sorted()
                .toList();
        if (!publishedWithoutSpec.isEmpty()) {
            throw new IllegalStateException("publish is on for " + publishedWithoutSpec + " but no AggregateSpec has that type;"
                    + " the types are " + types);
        }
        List<String> unknown = topics.keySet().stream()
                .filter(type -> !types.contains(type))
                .sorted()
                .toList();
        if (!unknown.isEmpty()) {
            log.warn("openframe.events.topics names {}, but no AggregateSpec has that type: a typo, or a config newer than this image",
                    unknown);
        }
    }
}
