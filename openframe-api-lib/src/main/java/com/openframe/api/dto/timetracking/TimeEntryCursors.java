package com.openframe.api.dto.timetracking;

import com.openframe.data.document.timetracking.TimeEntry;

import java.time.LocalDate;
import java.time.ZoneOffset;

public final class TimeEntryCursors {

    public static final String DATE_FIELD = "date";

    private TimeEntryCursors() {
    }

    public static String date(TimeEntry entry) {
        String dayKey = entry.getStartedAt() != null
                ? LocalDate.ofInstant(entry.getStartedAt(), ZoneOffset.UTC).toString()
                : "0000-00-00";
        long createdMillis = entry.getCreatedAt() != null ? entry.getCreatedAt().toEpochMilli() : 0L;
        return dayKey + "_" + createdMillis + "_" + entry.getId();
    }
}
