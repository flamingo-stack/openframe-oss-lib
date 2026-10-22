package com.openframe.publishing.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

// Keyed by type name; PublishedAggregateStartupCheck refuses publish: true for a name no spec has, such as organisations.
@Data
@ConfigurationProperties(prefix = "openframe.events")
public class EventsProperties {

    private Map<String, Topic> topics = new ConcurrentHashMap<>();

    @Data
    public static class Topic {

        private boolean publish;
    }
}
