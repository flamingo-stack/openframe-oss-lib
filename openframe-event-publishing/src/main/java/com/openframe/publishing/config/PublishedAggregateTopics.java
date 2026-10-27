package com.openframe.publishing.config;


import java.util.Map;
import java.util.Set;

import static java.util.stream.Collectors.toUnmodifiableSet;

// Copied at startup: a config refresh (the AI agent's ContextRefresher) must not switch publishing in one pod alone.
public class PublishedAggregateTopics {

    private final Set<String> publishing;

    public PublishedAggregateTopics(EventsProperties properties) {
        Map<String, EventsProperties.Topic> topics = properties.getTopics();
        Set<String> enabledTypes = topics.entrySet().stream()
                .filter(entry -> entry.getValue().isEnabled())
                .map(Map.Entry::getKey)
                .collect(toUnmodifiableSet());
        // A type counts only with the feature on, so an aspect never stops while nothing is published.
        this.publishing = properties.isEnabled() ? enabledTypes : Set.of();
    }

    public boolean isPublishing(String type) {
        return publishing.contains(type);
    }
}
