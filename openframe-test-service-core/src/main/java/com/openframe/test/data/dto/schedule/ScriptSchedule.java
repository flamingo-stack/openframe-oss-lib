package com.openframe.test.data.dto.schedule;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.openframe.test.data.dto.script.Script;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * A script schedule as exposed by the {@code scriptSchedule}/{@code scriptSchedules} GraphQL API
 * (openframe-api-service-core {@code script-schedule.graphqls}). Enum-typed fields carry the schema
 * enum names: {@code trigger} DATE_TIME | DEVICE_ONLINE, {@code timeReference} SERVER | DEVICE_LOCAL,
 * {@code offlineBehavior} SKIP | RETRY_ON_RECONNECT, {@code selectionMode} SPECIFIC | CRITERIA,
 * {@code status} ACTIVE | ARCHIVED | DELETED. Instants are ISO-8601 strings.
 * <p>
 * Not to be confused with {@code data.dto.script.ScriptSchedule}, which is the legacy Tactical-RMM
 * task shape and matches nothing in this schema.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ScriptSchedule {
    private String id;
    private String name;
    private String description;
    private List<String> supportedPlatforms;
    private String selectionMode;
    private String trigger;
    private String timeReference;
    private String offlineBehavior;
    private Long reconnectWindowSeconds;
    private String startAt;
    private Long repeat;
    private String nextRunAt;
    private String lastRunAt;
    private List<Script> scripts;
    private Integer deviceCount;
    private String status;
    private String statusChangedAt;
    private String createdAt;
    private String updatedAt;
}
