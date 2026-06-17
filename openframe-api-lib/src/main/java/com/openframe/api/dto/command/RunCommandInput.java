package com.openframe.api.dto.command;

import com.openframe.data.document.rmm.PrivilegeLevel;
import com.openframe.data.document.rmm.ScriptShell;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import lombok.Data;

/**
 * GraphQL input for dispatching an ad-hoc shell command to an agent.
 */
@Data
public class RunCommandInput {

    @NotBlank
    @Pattern(regexp = "^[A-Za-z0-9_-]+$", message = "machineId must be a single subject-safe token (A-Za-z0-9_-)")
    private String machineId;

    @NotBlank
    private String command;

    @NotNull
    private ScriptShell shell;

    @NotNull
    private PrivilegeLevel privilegeLevel;

    @Positive
    @Max(value = 600, message = "timeoutSeconds must not exceed 600 (10 minutes)")
    private Integer timeoutSeconds;
}
