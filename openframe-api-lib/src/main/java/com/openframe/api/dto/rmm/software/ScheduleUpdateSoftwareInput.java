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

    @NotNull
    private Instant scheduledAt;
}
