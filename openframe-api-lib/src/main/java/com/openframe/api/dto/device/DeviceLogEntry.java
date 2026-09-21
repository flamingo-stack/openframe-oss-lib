package com.openframe.api.dto.device;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeviceLogEntry {

    /**
     * When the logs pipeline ingested the entry, nanosecond precision. The sort key.
     */
    private Instant timestamp;

    /**
     * When the agent wrote the line, as reported by the agent.
     */
    private Instant agentTimestamp;

    private String level;

    private String message;

    private String hostname;

    /**
     * Number of identical lines the agent collapsed into this entry.
     */
    private Long count;

    /**
     * Opaque cursor positioned at this entry.
     */
    private String cursor;
}
