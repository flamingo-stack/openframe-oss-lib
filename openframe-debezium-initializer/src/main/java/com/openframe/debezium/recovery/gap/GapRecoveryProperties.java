package com.openframe.debezium.recovery.gap;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.constraints.NotNull;
import java.time.Duration;

@Getter
@Setter
@Validated
@Component
@ConditionalOnProperty(name = "openframe.debezium.recovery.gap.enabled", havingValue = "true")
@ConfigurationProperties(prefix = "openframe.debezium.recovery.gap")
public class GapRecoveryProperties {

    @NotNull
    private Duration margin;

    @NotNull
    private Duration fallbackLookback;

    @NotNull
    private Duration backfillExpiry;

    @NotNull
    private Duration checkpointMaxAge;
}
