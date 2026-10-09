package com.openframe.data.loki.toolevent;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public class ToolEventLog {

    private String tenantId;
    private String toolType;
    private String eventType;
    private String toolEventId;
    private String ingestDay;
    private long eventTimestamp;
    private String severity;
    private String message;
    private String details;
    private String userId;
    private String deviceId;
    private String hostname;
    private String nickname;
    private String executionSource;
    private String scriptCreationSource;
    private String organizationId;
    private String organizationName;
}
