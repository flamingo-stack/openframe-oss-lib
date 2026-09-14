package com.openframe.api.dto.rmm.schedule;

import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.schedule.ScheduleDeviceCriteria;
import com.openframe.data.document.rmm.schedule.ScheduleDeviceSelectionMode;
import com.openframe.data.document.rmm.schedule.ScheduledScriptCustomParams;
import com.openframe.data.document.rmm.schedule.ScheduleOfflineBehavior;
import com.openframe.data.document.rmm.schedule.ScheduleScriptTrigger;
import com.openframe.data.document.rmm.schedule.ScheduleTimeReference;
import com.openframe.data.document.rmm.script.ScriptStatus;
import jakarta.validation.constraints.NotEmpty;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;

@Data
@Builder
public class ScriptScheduleResponse {

    private String id;
    private String name;
    private String description;

    @NotEmpty
    private List<OsType> supportedPlatforms;

    private List<String> scriptIds;

    private List<ScheduledScriptCustomParams> scriptCustomParams;

    private ScheduleDeviceSelectionMode selectionMode;

    private ScheduleDeviceCriteria deviceCriteria;

    private ScheduleScriptTrigger trigger;

    private ScheduleTimeReference timeReference;

    private ScheduleOfflineBehavior offlineBehavior;

    private Long reconnectWindowSeconds;

    private Instant startAt;
    private Long repeat;
    private Instant nextRunAt;
    private Instant lastRunAt;

    private String createdBy;

    private ScriptStatus status;

    private Instant statusChangedAt;
    private Instant createdAt;
    private Instant updatedAt;
}
