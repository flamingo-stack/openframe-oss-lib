package com.openframe.processing.mode;

import com.openframe.processing.config.properties.ProcessingModeProperties;

import java.util.Map;

import static java.util.stream.Collectors.toUnmodifiableMap;

// Copied at startup: a config refresh (the AI agent's ContextRefresher) must not switch one pod alone; a change needs a restart.
public class ProcessingModes {

    private final Map<String, ProcessingMode> modes;

    public ProcessingModes(ProcessingModeProperties properties) {
        Map<String, ProcessingModeProperties.Processor> processors = properties.getProcessors();
        this.modes = processors.entrySet().stream()
                .collect(toUnmodifiableMap(Map.Entry::getKey, entry -> entry.getValue().getMode()));
    }

    public boolean runsProcessor(String processorName) {
        ProcessingMode mode = modes.getOrDefault(processorName, ProcessingMode.ASPECT);
        return mode != ProcessingMode.ASPECT;
    }
}
