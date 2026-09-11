package com.openframe.api.service.rmm.schedule;

import com.openframe.core.exception.BadRequestException;
import lombok.experimental.UtilityClass;

import java.time.Instant;

@UtilityClass
public final class ScheduleGrid {

    public static final long SLOT_SECONDS = 1800L;

    public static boolean isOnSlot(Instant instant) {
        return instant.getNano() == 0 && Math.floorMod(instant.getEpochSecond(), SLOT_SECONDS) == 0;
    }

    public static void validateGrid(Instant startAt, Long repeatSeconds) {
        if (startAt != null && !isOnSlot(startAt)) {
            throw new BadRequestException(
                    "startAt must fall on a 30-minute boundary (xx:00 or xx:30), got " + startAt);
        }
        if (repeatSeconds != null && (repeatSeconds <= 0 || repeatSeconds % SLOT_SECONDS != 0)) {
            throw new BadRequestException(
                    "repeat must be a positive whole number of 30-minute slots (multiple of " + SLOT_SECONDS
                            + " seconds), got " + repeatSeconds);
        }
    }
}
