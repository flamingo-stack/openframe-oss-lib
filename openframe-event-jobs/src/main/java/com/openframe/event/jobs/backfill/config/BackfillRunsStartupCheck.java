package com.openframe.event.jobs.backfill.config;

import com.openframe.event.jobs.backfill.config.properties.EventBackfillProperties;
import com.openframe.publishing.config.PublishedAggregateTopics;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.SmartInitializingSingleton;

import java.util.List;
import java.util.Set;

// A run id for a type no spec has would never run; a typo such as organisations stops the service instead.
// A run id for a type switched off waits until the type is on; that is said once here, not on every tick.
@Slf4j
@RequiredArgsConstructor
public class BackfillRunsStartupCheck implements SmartInitializingSingleton {

    private final EventBackfillProperties properties;
    private final AggregateSpecRegistry specRegistry;
    private final PublishedAggregateTopics publishedTopics;

    @Override
    public void afterSingletonsInstantiated() {
        Set<String> types = specRegistry.types();
        List<String> unknown = properties.getRuns().keySet().stream()
                .filter(type -> !types.contains(type))
                .sorted()
                .toList();
        if (!unknown.isEmpty()) {
            throw new IllegalStateException("openframe.events.jobs.backfill.runs names " + unknown
                    + ", but no AggregateSpec has that type; the types are " + types);
        }
        List<String> switchedOff = properties.getRuns().keySet().stream()
                .filter(type -> !publishedTopics.isPublishing(type))
                .sorted()
                .toList();
        if (!switchedOff.isEmpty()) {
            log.warn("Backfill run ids are set for {}, but those types are switched off in this service: they run once "
                    + "openframe.events.topics.<type>.enabled is on", switchedOff);
        }
    }
}
