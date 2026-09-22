package com.openframe.api.dto.rmm.software;

import com.openframe.data.document.rmm.schedule.ScheduleOfflineBehavior;
import com.openframe.data.document.rmm.schedule.ScheduleTimeReference;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.Instant;

@Data
public class SoftwareBundleScheduleInput {

    private String name;
    private String description;
    private ScheduleTimeReference timeReference;
    private ScheduleOfflineBehavior offlineBehavior;
    private Long reconnectWindowSeconds;

    @NotNull(message = "startAt is required")
    private Instant startAt;

    private Long repeat;
}
