package com.openframe.event.jobs.task.config.properties;

import com.openframe.event.jobs.core.service.EventJobSettings;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;

// enabled is read by ProjectionTaskConfiguration's condition and poll-interval by @Scheduled (default 10s), not here.
@Data
@Validated
@ConfigurationProperties(prefix = "openframe.events.jobs.projection-tasks")
public class ProjectionTaskProperties implements EventJobSettings {

    // Items per write; a backfill can open many tasks at once, so the pause keeps them from loading Mongo.
    @Positive
    private int batchSize = 1000;

    @NotNull
    private Duration pause = Duration.ofMillis(200);

    // A task works for half of it per tick, so the lock outlives the tick.
    @NotNull
    private Duration lockAtMostFor = Duration.ofMinutes(2);

    @Positive
    private int maxFailures = 3;
}
