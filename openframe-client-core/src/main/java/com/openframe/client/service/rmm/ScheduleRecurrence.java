package com.openframe.client.service.rmm;

import lombok.experimental.UtilityClass;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

@UtilityClass
public final class ScheduleRecurrence {

    public static Optional<Instant> nextRunAfter(Instant currentNextRun, Long repeatSeconds, Instant now) {
        if (repeatSeconds == null || repeatSeconds <= 0) {
            return Optional.empty();
        }
        Duration step = Duration.ofSeconds(repeatSeconds);
        Instant next = currentNextRun != null ? currentNextRun : now;
        while (!next.isAfter(now)) {
            next = next.plus(step);
        }
        return Optional.of(next);
    }
}
