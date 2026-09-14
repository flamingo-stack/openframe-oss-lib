package com.openframe.data.pinot.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;


@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class LogProjection {
    private String toolEventId;
    private String ingestDay;
    private String toolType;
    private String eventType;
    private String severity;
    private String userId;
    private String deviceId;
    private String hostname;
    private String organizationId;
    private String organizationName;
    private String summary;
    private Instant eventTimestamp;
}
