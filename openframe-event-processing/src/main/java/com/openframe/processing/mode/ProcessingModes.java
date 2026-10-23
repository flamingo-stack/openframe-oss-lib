package com.openframe.processing.mode;

import com.openframe.processing.config.properties.ProcessingModeProperties;

import java.util.Map;

import static java.util.stream.Collectors.toUnmodifiableMap;

// Copied at startup: a config refresh (the AI agent's ContextRefresher) must not switch one pod alone; a change needs a restart.
public class ProcessingModes {

    private final Map<String, ProcessingMode> modes;

    public ProcessingModes(ProcessingModeProperties properties) {
        Map<String, ProcessingModeProperties.ProjectionSettings> projections = properties.getProjections();
        this.modes = projections.entrySet().stream()
                .collect(toUnmodifiableMap(Map.Entry::getKey, entry -> entry.getValue().getMode()));
    }

    public boolean runsProjection(String projectionName) {
        ProcessingMode mode = modes.getOrDefault(projectionName, ProcessingMode.ASPECT);
        return mode != ProcessingMode.ASPECT;
    }
}
