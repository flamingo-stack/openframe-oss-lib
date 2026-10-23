package com.openframe.publishing.config;


import java.util.Map;
import java.util.Set;

import static java.util.stream.Collectors.toUnmodifiableSet;

// Copied at startup: a config refresh (the AI agent's ContextRefresher) must not switch publishing in one pod alone.
public class PublishedAggregateTopics {

    private final Set<String> publishing;

    public PublishedAggregateTopics(EventsProperties properties) {
        Map<String, EventsProperties.Topic> topics = properties.getTopics();
        this.publishing = topics.entrySet().stream()
                .filter(entry -> entry.getValue().isPublish())
                .map(Map.Entry::getKey)
                .collect(toUnmodifiableSet());
    }

    public boolean isPublishing(String type) {
        return publishing.contains(type);
    }
}
