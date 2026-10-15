package com.openframe.stream.config;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

@Getter
@Setter
@Validated
@Component
@ConfigurationProperties(prefix = "openframe.tool-events")
public class ToolEventProperties {

    @NotNull
    private Store store;

    public enum Store {
        LOKI,
        CASSANDRA
    }
}
