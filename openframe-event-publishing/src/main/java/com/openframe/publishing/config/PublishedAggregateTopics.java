package com.openframe.publishing.config;

import com.openframe.publishing.api.PublishedAggregateType;

import java.util.Map;
import java.util.Set;

import static java.util.stream.Collectors.toUnmodifiableSet;

// Copied at startup: a config refresh (the AI agent's ContextRefresher) must not switch publishing in one pod alone.
public class PublishedAggregateTopics {

    private final Set<PublishedAggregateType> publishing;

    public PublishedAggregateTopics(EventsProperties properties) {
        Map<PublishedAggregateType, EventsProperties.Topic> topics = properties.getTopics();
        this.publishing = topics.entrySet().stream()
                .filter(entry -> entry.getValue().isPublish())
                .map(Map.Entry::getKey)
                .collect(toUnmodifiableSet());
    }

    public boolean isPublishing(PublishedAggregateType type) {
        return publishing.contains(type);
    }
}
