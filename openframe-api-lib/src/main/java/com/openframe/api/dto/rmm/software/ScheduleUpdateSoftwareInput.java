package com.openframe.api.dto.rmm.software;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.Instant;
import java.util.List;

@Data
public class ScheduleUpdateSoftwareInput {
    @NotNull
    private String softwareId;

    @NotEmpty
    private List<String> machineIds;

    /** UTC instant at which the update should fire on each device. */
    @NotNull
    private Instant scheduledAt;
}
