package com.openframe.kafka.model;

import lombok.Data;

@Data
public class IntegratedToolEvent {
    private String toolEventId;
    private String userId;
    private String deviceId;
    private String ingestDay;
    private String toolType;
    private String eventType;
    private String severity;
    private String summary;
    private Long eventTimestamp;
}

