package com.openframe.processing.registry;

import com.openframe.processing.api.EventProcessor;
import com.openframe.publishing.api.PublishedAggregateType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

import static java.util.function.Function.identity;
import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.toUnmodifiableList;
import static java.util.stream.Collectors.toUnmodifiableMap;

// Collects the processor beans: two with one name stop the service, and processorsOf gives the processors of a topic.
@Slf4j
public class EventProcessorRegistry {

    private final Map<String, EventProcessor<?>> byName;
    private final Map<PublishedAggregateType, List<EventProcessor<?>>> byType;

    // ObjectProvider, not List: a service with no processor bean must still start.
    public EventProcessorRegistry(ObjectProvider<EventProcessor<?>> processorBeans) {
        this.byName = processorBeans.stream().collect(toUnmodifiableMap(EventProcessor::name, identity()));
        // Sorted by name: the processors run, and the first failure is chosen, in the same order on every pod.
        Comparator<EventProcessor<?>> byProcessorName = Comparator.comparing(EventProcessor::name);
        Map<PublishedAggregateType, List<EventProcessor<?>>> grouped = byName.values().stream()
                .sorted(byProcessorName)
                .collect(groupingBy(EventProcessor::getType, toUnmodifiableList()));
        this.byType = Map.copyOf(grouped);
        Set<String> registeredNames = byName.keySet();
        Set<String> names = new TreeSet<>(registeredNames);
        log.info("Registered {} processor(s): {}", byName.size(), names);
    }

    public List<EventProcessor<?>> processorsOf(PublishedAggregateType type) {
        return byType.getOrDefault(type, List.of());
    }

    public boolean contains(String processorName) {
        return byName.containsKey(processorName);
    }

    public Set<String> names() {
        return byName.keySet();
    }

    public Set<PublishedAggregateType> types() {
        return byType.keySet();
    }
}
