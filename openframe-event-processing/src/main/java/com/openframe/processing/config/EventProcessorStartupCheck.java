package com.openframe.processing.config;

import com.openframe.processing.config.properties.ProcessingModeProperties;
import com.openframe.processing.registry.EventProcessorRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.SmartInitializingSingleton;

import java.util.List;
import java.util.Set;

// An unknown processor name is an ERROR, not a failed start: an image rolled back under a newer config must still start.
@Slf4j
@RequiredArgsConstructor
public class EventProcessorStartupCheck implements SmartInitializingSingleton {

    private final ProcessingModeProperties properties;
    private final EventProcessorRegistry registry;

    @Override
    public void afterSingletonsInstantiated() {
        Set<String> configured = properties.getProcessors().keySet();
        List<String> unknown = configured.stream()
                .filter(name -> !registry.contains(name))
                .sorted()
                .toList();
        if (!unknown.isEmpty()) {
            log.error("openframe.events.processing.processors names {}, but no processor has that name: a typo, or a config "
                    + "newer than this image", unknown);
        }
    }
}
