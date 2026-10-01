package com.openframe.test.data.dto.device;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

// timestamp is the ingestion time with nanosecond precision, the sort key; agentTimestamp is when the agent wrote the line.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class DeviceLogEntry {
    private String timestamp;
    private String agentTimestamp;
    private String level;
    private String message;
    private String machineId;
    private String hostname;
    private Long count;

    public Instant timestampInstant() {
        return Instant.parse(timestamp);
    }
}
