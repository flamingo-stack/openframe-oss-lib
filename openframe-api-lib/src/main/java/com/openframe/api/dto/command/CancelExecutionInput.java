package com.openframe.api.dto.command;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class CancelExecutionInput {

    @NotBlank
    @Pattern(regexp = "^[A-Za-z0-9_-]+$", message = "machineId must be a single subject-safe token (A-Za-z0-9_-)")
    private String machineId;

    @NotBlank
    private String executionId;
}
