package com.openframe.event.jobs.backfill.config;

import com.openframe.event.jobs.backfill.config.properties.EventBackfillProperties;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.SmartInitializingSingleton;

import java.util.List;
import java.util.Set;

// A run id for a type no spec has would never run; a typo such as organisations stops the service instead.
@RequiredArgsConstructor
public class BackfillRunsStartupCheck implements SmartInitializingSingleton {

    private final EventBackfillProperties properties;
    private final AggregateSpecRegistry specRegistry;

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
    }
}
