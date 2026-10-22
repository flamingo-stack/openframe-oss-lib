package com.openframe.processing.config;

import com.openframe.processing.config.properties.ProcessingModeProperties;
import com.openframe.publishing.api.spec.Projection;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.SmartInitializingSingleton;

import java.util.List;
import java.util.Set;

import static java.util.stream.Collectors.toUnmodifiableSet;

// An unknown projection name is an ERROR, not a failed start: an image rolled back under a newer config must still start.
@Slf4j
@RequiredArgsConstructor
public class ProcessingModeStartupCheck implements SmartInitializingSingleton {

    private final ProcessingModeProperties properties;
    private final AggregateSpecRegistry specRegistry;

    @Override
    public void afterSingletonsInstantiated() {
        List<Projection<?, ?>> projections = specRegistry.projections();
        Set<String> names = projections.stream().map(Projection::name).collect(toUnmodifiableSet());
        Set<String> configured = properties.getProjections().keySet();
        List<String> unknown = configured.stream()
                .filter(name -> !names.contains(name))
                .sorted()
                .toList();
        if (!unknown.isEmpty()) {
            log.error("openframe.events.processing.projections names {}, but no projection has that name: a typo, or a config "
                    + "newer than this image", unknown);
        }
    }
}
