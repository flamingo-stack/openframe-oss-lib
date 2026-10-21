package com.openframe.processing.config;

import com.openframe.processing.listener.AggregateEventListener;
import com.openframe.processing.registry.EventProcessorRegistry;
import com.openframe.publishing.api.PublishedAggregateType;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.SmartInitializingSingleton;

import java.util.List;
import java.util.Set;

import static java.util.stream.Collectors.toUnmodifiableSet;

// A processor whose type has no listener would never receive an event, silently; refuse to start.
@RequiredArgsConstructor
public class EventListenerStartupCheck implements SmartInitializingSingleton {

    private final EventProcessorRegistry registry;
    private final ObjectProvider<AggregateEventListener> listeners;

    @Override
    public void afterSingletonsInstantiated() {
        Set<PublishedAggregateType> listened = listeners.stream()
                .map(AggregateEventListener::getType)
                .collect(toUnmodifiableSet());
        Set<PublishedAggregateType> types = registry.types();
        List<String> unheard = types.stream()
                .filter(type -> !listened.contains(type))
                .map(PublishedAggregateType::getName)
                .sorted()
                .toList();
        if (!unheard.isEmpty()) {
            throw new IllegalStateException("Processors read " + unheard
                    + ", but no listener reads that topic: add an AggregateEventListener for it");
        }
    }
}
