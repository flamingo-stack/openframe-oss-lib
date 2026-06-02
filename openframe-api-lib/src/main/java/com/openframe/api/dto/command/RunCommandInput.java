package com.openframe.api.dto.command;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.util.List;

/**
 * GraphQL input for dispatching an ad-hoc shell command to an agent.
 */
@Data
public class RunCommandInput {

    @NotBlank
    private String machineId;

    @NotBlank
    private String shell;

    @NotBlank
    private String command;

    private List<String> args;

    private List<String> envVars;

    @Positive
    private Integer timeoutSeconds;
}
