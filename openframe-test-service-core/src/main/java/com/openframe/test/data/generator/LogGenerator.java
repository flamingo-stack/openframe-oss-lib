package com.openframe.test.data.generator;

import com.openframe.test.data.dto.log.LogFilterInput;

import java.util.List;

public class LogGenerator {

    public static LogFilterInput severityAndToolFilter(String severity, String toolType) {
        return LogFilterInput.builder()
                .severities(List.of(severity))
                .toolTypes(List.of(toolType))
                .build();
    }

    public static String searchTerm(String summary) {
        String[] words = summary.split(" ");
        return words[0];
    }
}
