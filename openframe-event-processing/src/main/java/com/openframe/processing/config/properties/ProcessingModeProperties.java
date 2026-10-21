package com.openframe.processing.config.properties;

import com.openframe.processing.mode.ProcessingMode;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.LinkedHashMap;
import java.util.Map;

@Data
@ConfigurationProperties(prefix = "openframe.events.processing")
public class ProcessingModeProperties {

    // Keyed by processor name; EventProcessorStartupCheck refuses a name no processor has.
    private Map<String, Processor> processors = new LinkedHashMap<>();

    @Data
    public static class Processor {

        private ProcessingMode mode = ProcessingMode.ASPECT;
    }
}
