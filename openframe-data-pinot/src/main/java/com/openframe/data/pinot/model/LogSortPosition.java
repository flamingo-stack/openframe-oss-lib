package com.openframe.data.pinot.model;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.ToString;

@Getter
@ToString
@EqualsAndHashCode
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class LogSortPosition {

    private final Long timestampMillis;
    private final String textValue;
    private final String toolEventId;

    public static LogSortPosition ofTimestamp(long timestampMillis, String toolEventId) {
        return new LogSortPosition(timestampMillis, null, toolEventId);
    }

    public static LogSortPosition ofText(String textValue, String toolEventId) {
        return new LogSortPosition(null, textValue, toolEventId);
    }

    public boolean isTimestamp() {
        return timestampMillis != null;
    }
}
