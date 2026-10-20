package com.openframe.publishing.config;

import com.openframe.publishing.api.PublishedAggregateType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PublishedAggregateTopics {

    private final EventsProperties properties;

    // Read on every call, not cached: a config refresh rebinds EventsProperties and the next write sees it.
    public boolean isPublishing(PublishedAggregateType type) {
        EventsProperties.Topic topic = properties.getTopics().get(type);
        return topic != null && topic.isPublish();
    }
}
