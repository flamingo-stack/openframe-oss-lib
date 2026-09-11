package com.openframe.api.dto.rmm.software;

import com.openframe.data.document.rmm.schedule.ScheduleDeviceSelectionMode;
import com.openframe.data.document.rmm.schedule.ScheduleOfflineBehavior;
import com.openframe.data.document.rmm.schedule.ScheduleScriptTrigger;
import com.openframe.data.document.rmm.schedule.ScheduleTimeReference;
import com.openframe.data.document.rmm.schedule.SoftwareSchedulePackage;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.document.rmm.software.SoftwareAction;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;

@Data
@Builder
public class SoftwareScheduleResponse {

    private String id;
    private String name;
    private String description;
    private SoftwareAction action;
    private List<SoftwareSchedulePackage> packages;
    private ScheduleDeviceSelectionMode selectionMode;
    private ScheduleScriptTrigger trigger;
    private ScheduleTimeReference timeReference;
    private ScheduleOfflineBehavior offlineBehavior;
    private Long reconnectWindowSeconds;
    private Instant startAt;
    private Long repeat;
    private Instant nextRunAt;
    private Instant lastRunAt;
    private ScriptStatus status;
    private String createdBy;
    private Instant createdAt;
    private Instant updatedAt;
}
