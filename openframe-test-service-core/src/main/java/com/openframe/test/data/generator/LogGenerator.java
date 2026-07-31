package com.openframe.test.data.generator;

import com.openframe.test.data.dto.log.LogFilterInput;
import com.openframe.test.data.dto.log.LogSortInput;

import java.util.List;

public class LogGenerator {

    public static LogFilterInput severityFilter(String severity) {
        return LogFilterInput.builder()
                .severities(List.of(severity))
                .build();
    }

    public static LogFilterInput timestampRangeFilter(String timestampFrom, String timestampTo) {
        return LogFilterInput.builder()
                .timestampFrom(timestampFrom)
                .timestampTo(timestampTo)
                .build();
    }

    public static LogSortInput timestampSort(String direction) {
        return LogSortInput.builder()
                .field("TIMESTAMP")
                .direction(direction)
                .build();
    }

    public static String searchTerm(String summary) {
        String[] words = summary.split(" ");
        return words[0];
    }
}
