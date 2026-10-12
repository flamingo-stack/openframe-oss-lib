package com.openframe.test.data.dto.schedule;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.openframe.test.data.dto.script.Script;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

// Not to be confused with data.dto.script.ScriptSchedule, the legacy Tactical-RMM task shape (matches nothing in this schema).
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
    private ScheduleDeviceCriteria deviceCriteria;
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
