package com.openframe.api.dto.rmm.script;

import com.openframe.data.document.rmm.script.PrivilegeLevel;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class BatchRunScriptInput {

    public static final int MAX_BATCH_SIZE = 100;

    @NotEmpty(message = "machineIds must not be empty")
    @Size(max = MAX_BATCH_SIZE, message = "machineIds must not exceed " + MAX_BATCH_SIZE + " machines per batch")
    private List<@NotBlank @Pattern(
            regexp = "^[A-Za-z0-9_-]+$",
            message = "each machineId must be a single subject-safe token (A-Za-z0-9_-)") String> machineIds;

    @NotBlank
    private String scriptId;

    @NotNull
    private PrivilegeLevel privilegeLevel;

    /** Optional override of the script's defaultArgs. */
    private List<String> args;

    private Integer timeoutSeconds;

    /** Run-time env vars merged over the script's stored env vars (same name overrides). */
    @Valid
    private List<ScriptEnvVarInput> envVars;
}
