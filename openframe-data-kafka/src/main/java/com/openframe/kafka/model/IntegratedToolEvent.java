package com.openframe.kafka.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IntegratedToolEvent implements KafkaMessage {
    private String tenantId;
    private String toolEventId;
    private String userId;
    private String deviceId;
    private String hostname;
    private String organizationId;
    private String organizationName;
    private String ingestDay;
    private String toolType;
    private String eventType;
    private String severity;
    private String summary;
    private Long eventTimestamp;
}

