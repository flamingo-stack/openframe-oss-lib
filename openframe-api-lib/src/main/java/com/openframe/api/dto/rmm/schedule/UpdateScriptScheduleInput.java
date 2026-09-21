package com.openframe.api.dto.rmm.schedule;

import com.openframe.data.document.rmm.schedule.ScheduleDeviceSelectionMode;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.schedule.ScheduleOfflineBehavior;
import com.openframe.data.document.rmm.schedule.ScheduleScriptTrigger;
import com.openframe.data.document.rmm.schedule.ScheduleTimeReference;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.Instant;
import java.util.List;

@Data
public class UpdateScriptScheduleInput {

    @NotBlank
    private String id;

    @NotBlank
    private String name;

    private String description;

    private List<OsType> supportedPlatforms;

    private List<String> scriptIds;

    @Valid
    private List<ScheduledScriptCustomParamsInput> scriptCustomParams;

    @NotNull
    private ScheduleScriptTrigger trigger;

    private ScheduleOfflineBehavior offlineBehavior;

    private Long reconnectWindowSeconds;

    private ScheduleDeviceSelectionMode selectionMode;

    private ScheduleTimeReference timeReference;

    private Instant startAt;

    @Min(value = 1800, message = "repeat must be at least 1800 seconds (30 minutes)")
    private Long repeat;
}
