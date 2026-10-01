package com.openframe.test.data.dto.script;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

// Payload for batchRunScript: one saved script fanned out to several raw machine ids under one executionId.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class BatchRunScriptInput {
    private List<String> machineIds;
    private String scriptId;
    private String privilegeLevel;
    private List<String> args;
    private Integer timeoutSeconds;
    private List<ScriptEnvVar> envVars;
}
