package com.openframe.client.service.rmm;

import lombok.experimental.UtilityClass;

import java.time.Duration;
import java.time.Instant;

@UtilityClass
public final class ScheduleRecurrence {

    public static Instant nextRunAfter(Instant currentNextRun, Long repeatSeconds, Instant now) {
        if (repeatSeconds == null || repeatSeconds <= 0) {
            return null;
        }
        Duration step = Duration.ofSeconds(repeatSeconds);
        Instant next = currentNextRun != null ? currentNextRun : now;
        while (!next.isAfter(now)) {
            next = next.plus(step);
        }
        return next;
    }
}
