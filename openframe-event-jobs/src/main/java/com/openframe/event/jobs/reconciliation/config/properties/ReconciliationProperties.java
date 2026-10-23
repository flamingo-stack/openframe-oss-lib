package com.openframe.event.jobs.reconciliation.config.properties;

import com.openframe.event.jobs.core.service.EventJobSettings;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;

// enabled is read by ReconciliationConfiguration's condition and poll-interval by @Scheduled (default 30s), not here.
@Data
@Validated
@ConfigurationProperties(prefix = "openframe.events.jobs.reconciliation")
public class ReconciliationProperties implements EventJobSettings {

    // When a new run is due, in UTC; the first run starts at once, for the baseline.
    @NotBlank
    private String cron = "0 0 3 * * *";

    @Positive
    private int batchSize = 1000;

    @NotNull
    private Duration pause = Duration.ofMillis(200);

    // A tick checks for half of it, so the lock outlives the tick; a dead pod's lock expires and another pod continues.
    @NotNull
    private Duration lockAtMostFor = Duration.ofMinutes(2);

    @Positive
    private int maxFailures = 3;

    @Positive
    private int sampleSize = 5;
}
