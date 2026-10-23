package com.openframe.api.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/** Shares the configured execution limit between script validation and AI tool schemas. */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "openframe.rmm.script")
public class ScriptExecutionProperties {

    private int maxTimeoutSeconds = 600;
}
