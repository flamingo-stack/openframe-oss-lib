package com.openframe.publishing.api;

import lombok.AllArgsConstructor;
import lombok.Getter;

// The aggregates that publish: the outbox aggregateType, the key under openframe.events.topics and the topic suffix.
@Getter
@AllArgsConstructor
public enum PublishedAggregateType {
    ORGANIZATIONS("organizations");

    private final String name;
}
