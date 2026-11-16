package com.openframe.stream.config;

import com.openframe.stream.service.rmm.ExecutionOutcomeClassifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ExecutionOutcomeConfig {

    private static final String SCRIPT_ERROR_STATUS_FLAG = "openframe.rmm.execution.script-error-status.enabled";

    @Bean
    @ConditionalOnProperty(name = SCRIPT_ERROR_STATUS_FLAG, havingValue = "true")
    public ExecutionOutcomeClassifier scriptErrorOutcomeClassifier() {
        return new ExecutionOutcomeClassifier(true);
    }

    @Bean
    @ConditionalOnProperty(name = SCRIPT_ERROR_STATUS_FLAG, havingValue = "false", matchIfMissing = true)
    public ExecutionOutcomeClassifier legacyOutcomeClassifier() {
        return new ExecutionOutcomeClassifier(false);
    }
}
