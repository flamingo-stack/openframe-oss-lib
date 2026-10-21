package com.openframe.publishing.config;

import com.openframe.publishing.api.PublishedAggregateSpec;
import com.openframe.publishing.api.PublishedAggregateType;
import com.openframe.publishing.spec.PublishedAggregateSpecRegistry;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.SmartInitializingSingleton;

import java.util.List;
import java.util.Map;

// publish on for a type no spec covers would silently write nothing; refuse to start instead.
@RequiredArgsConstructor
public class PublishedAggregateStartupCheck implements SmartInitializingSingleton {

    private final EventsProperties properties;
    private final PublishedAggregateSpecRegistry registry;

    @Override
    public void afterSingletonsInstantiated() {
        Map<PublishedAggregateType, EventsProperties.Topic> topics = properties.getTopics();
        List<String> withoutSpec = topics.entrySet().stream()
                .filter(entry -> entry.getValue().isPublish())
                .map(Map.Entry::getKey)
                .filter(type -> !registry.hasSpec(type))
                .map(PublishedAggregateType::getName)
                .toList();
        if (!withoutSpec.isEmpty()) {
            throw new IllegalStateException("publish is on for " + withoutSpec + " but no PublishedAggregateSpec covers it");
        }
    }
}
