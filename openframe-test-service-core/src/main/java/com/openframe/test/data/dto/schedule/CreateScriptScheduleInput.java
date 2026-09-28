package com.openframe.test.data.dto.schedule;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Payload for the {@code createScriptSchedule} mutation. Optional fields are omitted when null so
 * the server applies its defaults ({@code timeReference} SERVER, {@code offlineBehavior} SKIP).
 * <p>
 * Contract (schema docstrings): {@code startAt} is required when {@code trigger} is DATE_TIME, must
 * be null for DEVICE_ONLINE, and must fall on a 30-minute boundary (xx:00 or xx:30); {@code repeat}
 * is a whole number of 30-minute slots in seconds (1800, 3600, …) or null for a one-shot.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CreateScriptScheduleInput {
    private String name;
    private String description;
    private List<String> supportedPlatforms;
    private List<String> scriptIds;
    private String trigger;
    private String timeReference;
    private String offlineBehavior;
    private Long reconnectWindowSeconds;
    private String startAt;
    private Long repeat;
}
