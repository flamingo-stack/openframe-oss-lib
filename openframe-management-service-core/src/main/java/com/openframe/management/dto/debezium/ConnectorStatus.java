package com.openframe.management.dto.debezium;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.Collections;
import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ConnectorStatus {

    private static final String FAILED = "FAILED";

    private String name;
    private Connector connector;
    private List<TaskStatus> tasks;

    public boolean isConnectorFailed() {
        return connector != null && FAILED.equals(connector.getState());
    }

    public boolean hasFailedTasks() {
        return tasks != null && tasks.stream().anyMatch(TaskStatus::isFailed);
    }

    public boolean hasFailures() {
        return isConnectorFailed() || hasFailedTasks();
    }

    public List<TaskStatus> getFailedTasks() {
        if (tasks == null) return Collections.emptyList();
        return tasks.stream().filter(TaskStatus::isFailed).toList();
    }

    /**
     * Collect all failure traces from failed tasks.
     */
    public List<String> getFailureTraces() {
        return getFailedTasks().stream()
                .map(TaskStatus::getTrace)
                .filter(trace -> trace != null && !trace.isBlank())
                .toList();
    }

    /**
     * Get the first line of the first failure trace, or "Unknown error" if none.
     */
    public String getFirstFailureTrace() {
        return getFailedTasks().stream()
                .map(TaskStatus::firstTraceLine)
                .filter(line -> !"N/A".equals(line))
                .findFirst()
                .orElse("Unknown error");
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Connector {
        private String state;
        private String workerId;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TaskStatus {
        private int id;
        private String state;
        private String workerId;
        private String trace;

        public boolean isFailed() {
            return FAILED.equals(state);
        }

        public String firstTraceLine() {
            return trace != null ? trace.split("\n")[0] : "N/A";
        }
    }
}