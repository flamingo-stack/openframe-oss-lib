package com.openframe.client.service.rmm;

import com.openframe.data.document.rmm.schedule.ScheduleLocalMachineTimeDispatch;

import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.apache.commons.lang3.StringUtils.isBlank;

public final class DeviceLocalOccurrence {

    public static final ZoneOffset LATEST_ZONE = ZoneOffset.ofHours(-12);

    private DeviceLocalOccurrence() {
    }

    public static LocalDateTime currentDueOccurrence(LocalDateTime startWallClock, Long repeat, ZoneId zone, Instant now) {
        Instant firstFireAt = startWallClock.atZone(zone).toInstant();
        if (now.isBefore(firstFireAt)) {
            return null;
        }
        if (repeat == null) {
            return startWallClock;
        }
        long elapsedSeconds = Duration.between(startWallClock, LocalDateTime.ofInstant(now, zone)).getSeconds();
        long k = Math.max(0, elapsedSeconds / repeat);
        LocalDateTime occurrence = startWallClock.plusSeconds(k * repeat);
        while (k > 0 && occurrence.atZone(zone).toInstant().isAfter(now)) {
            k--;
            occurrence = startWallClock.plusSeconds(k * repeat);
        }
        return occurrence;
    }

    public static ZoneId parseZone(String zoneId) {
        try {
            return ZoneId.of(zoneId);
        } catch (DateTimeException e) {
            return null;
        }
    }

    public static Instant latestPossibleFireAt(LocalDateTime wallClock, String storedTimezone) {
        if (!isBlank(storedTimezone)) {
            try {
                return wallClock.atZone(ZoneId.of(storedTimezone)).toInstant();
            } catch (DateTimeException ignored) {
                // fall through to the global upper bound
            }
        }
        return wallClock.atOffset(LATEST_ZONE).toInstant();
    }

    public static boolean isHandled(ScheduleLocalMachineTimeDispatch sentinel) {
        return sentinel != null && sentinel.getLastOccurrenceAt() != null;
    }

    public static boolean isAlreadyHandled(ScheduleLocalMachineTimeDispatch sentinel, Instant occurrenceAt) {
        return sentinel != null && sentinel.getLastOccurrenceAt() != null
                && !occurrenceAt.isAfter(sentinel.getLastOccurrenceAt());
    }
}
