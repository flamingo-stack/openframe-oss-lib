package com.openframe.publishing.config;

import com.openframe.publishing.api.PublishedAggregateType;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

// Keyed by the enum: an unknown key such as openframe.events.topics.organisations fails binding, so the service does not start.
@Data
@ConfigurationProperties(prefix = "openframe.events")
public class EventsProperties {

    private Map<PublishedAggregateType, Topic> topics = new ConcurrentHashMap<>();

    @Data
    public static class Topic {

        private boolean publish;
    }
}
