package com.openframe.management.dto.debezium;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ConnectorStatus {
    private String name;
    private Connector connector;
    private List<TaskStatus> tasks;

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
    }
}