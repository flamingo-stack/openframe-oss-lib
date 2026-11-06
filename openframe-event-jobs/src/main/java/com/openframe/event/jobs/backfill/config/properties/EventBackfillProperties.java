package com.openframe.event.jobs.backfill.config.properties;

import com.openframe.event.jobs.core.service.EventJobSettings;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

// poll-interval is read by @Scheduled on EventBackfillJob.runAll, not here (default 30s).
@Data
@Validated
@ConfigurationProperties(prefix = "openframe.events.jobs.backfill")
public class EventBackfillProperties implements EventJobSettings {

    // The run id per type; a new one starts that type again from its first document. A type no spec has stops the service.
    @NotNull
    private Map<String, String> runs = new HashMap<>();

    @Positive
    private int batchSize = 500;

    @NotNull
    private Duration pause = Duration.ofMillis(200);

    // A tick writes for half of it, so the lock outlives the tick; a dead pod's lock expires and another pod continues.
    @NotNull
    private Duration lockAtMostFor = Duration.ofMinutes(2);

    @Positive
    private int maxFailures = 3;
}
