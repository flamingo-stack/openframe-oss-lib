package com.openframe.api.dto.rmm.software;

import com.openframe.data.document.rmm.schedule.ScheduleOfflineBehavior;
import com.openframe.data.document.rmm.schedule.ScheduleTimeReference;
import com.openframe.data.document.rmm.software.SoftwareAction;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.Instant;
import java.util.List;

@Data
public class CreateSoftwareScheduleInput {

    @NotBlank
    private String name;

    private String description;

    @NotNull
    private SoftwareAction action;

    @NotEmpty
    @Valid
    private List<SoftwareSchedulePackageInput> packages;

    private ScheduleTimeReference timeReference;

    private ScheduleOfflineBehavior offlineBehavior;

    private Long reconnectWindowSeconds;

    @NotNull
    private Instant startAt;

    private Long repeat;

    private List<String> machineIds;
}
