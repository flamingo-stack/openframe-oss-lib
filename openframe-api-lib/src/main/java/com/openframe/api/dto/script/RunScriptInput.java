package com.openframe.api.dto.script;

import com.openframe.data.document.rmm.PrivilegeLevel;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.util.List;

/**
 * GraphQL input for dispatching a <b>saved</b> script to an agent.
 */
@Data
public class RunScriptInput {

    @NotBlank
    @Pattern(regexp = "^[A-Za-z0-9_-]+$", message = "machineId must be a single subject-safe token (A-Za-z0-9_-)")
    private String machineId;

    @NotBlank
    private String scriptId;

    @NotNull
    private PrivilegeLevel privilegeLevel;

    private List<String> args;

    @Positive
    @Max(value = 600, message = "timeoutSeconds must not exceed 600 (10 minutes)")
    private Integer timeoutSeconds;

    @Valid
    private List<ScriptEnvVarInput> envVars;
}
