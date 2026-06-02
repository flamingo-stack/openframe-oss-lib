package com.openframe.api.dto.command;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CancelExecutionInput {

    @NotBlank
    private String machineId;

    @NotBlank
    private String executionId;
}
