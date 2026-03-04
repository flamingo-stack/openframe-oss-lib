package com.openframe.test.data.generator;

import com.openframe.test.data.dto.log.LogFilterInput;

import java.util.List;

public class LogGenerator {

    public static LogFilterInput severityFilter(String severity) {
        return LogFilterInput.builder()
                .severities(List.of(severity))
                .build();
    }

    public static String searchTerm(String summary) {
        String[] words = summary.split(" ");
        return words[0];
    }
}
