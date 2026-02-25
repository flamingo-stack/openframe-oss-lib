package com.openframe.data.model.pinot;

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
    public String toolEventId;
    public String ingestDay;
    public String toolType;
    public String eventType;
    public String severity;
    public String userId;
    public String deviceId;
    public String hostname;
    public String organizationId;
    public String organizationName;
    public String summary;
    public Instant eventTimestamp;
}