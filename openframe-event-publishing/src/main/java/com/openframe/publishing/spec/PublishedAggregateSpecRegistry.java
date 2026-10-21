package com.openframe.publishing.spec;

import com.openframe.publishing.api.PublishedAggregateSpec;
import com.openframe.publishing.api.PublishedAggregateType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;

import java.util.Map;
import java.util.TreeSet;

import static java.util.function.Function.identity;
import static java.util.stream.Collectors.toUnmodifiableMap;

// Collects the spec beans by aggregate type: two specs for one type stop the service, and hasSpec tells which types can publish.
@Slf4j
public class PublishedAggregateSpecRegistry {

    private final Map<PublishedAggregateType, PublishedAggregateSpec<?, ?>> byType;

    // ObjectProvider, not List: a service with no spec bean must still start.
    public PublishedAggregateSpecRegistry(ObjectProvider<PublishedAggregateSpec<?, ?>> specBeans) {
        this.byType = specBeans.stream().collect(toUnmodifiableMap(PublishedAggregateSpec::getType, identity()));
        TreeSet<String> types = new TreeSet<>(byType.keySet().stream().map(PublishedAggregateType::getName).toList());
        log.info("Registered {} published aggregate spec(s): {}", byType.size(), types);
    }

    public boolean hasSpec(PublishedAggregateType type) {
        return byType.containsKey(type);
    }
}
