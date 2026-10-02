package com.openframe.management.config.pinot;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Getter
@Setter
@Validated
@ConfigurationProperties(prefix = "pinot.config")
public class PinotConfigProperties {

    @NotNull
    private Boolean enabled;

    @NotNull
    private Retry retry;

    @Getter
    @Setter
    @Validated
    public static class Retry {

        @Min(0)
        @NotNull
        private Integer maxAttempts;

        @Min(0)
        @NotNull
        private Long delayMs;
    }
}
