package com.openframe.processing.config.properties;

import com.openframe.processing.mode.ProcessingMode;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.LinkedHashMap;
import java.util.Map;

@Data
@ConfigurationProperties(prefix = "openframe.events.processing")
public class ProcessingModeProperties {

    // Keyed by projection name; ProcessingModeStartupCheck logs an ERROR for a name no projection has.
    private Map<String, ProjectionSettings> projections = new LinkedHashMap<>();

    @Data
    public static class ProjectionSettings {

        private ProcessingMode mode = ProcessingMode.ASPECT;
    }
}
