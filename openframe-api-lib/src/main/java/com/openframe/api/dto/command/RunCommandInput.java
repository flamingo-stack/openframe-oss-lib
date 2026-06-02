package com.openframe.api.dto.command;

import com.openframe.data.document.rmm.ScriptShell;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

/**
 * GraphQL input for dispatching an ad-hoc shell command to an agent.
 */
@Data
public class RunCommandInput {

    @NotBlank
    private String machineId;

    @NotBlank
    private String command;

    @NotNull
    private ScriptShell shell;

    @Positive
    private Integer timeoutSeconds;
}
