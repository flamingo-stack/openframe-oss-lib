package com.openframe.test.data.dto.script;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

// Payload for runScript; null overrides are omitted so the script's stored defaults apply.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class RunScriptInput {
    private String machineId;
    private String scriptId;
    private String privilegeLevel;
    private List<String> args;
    private Integer timeoutSeconds;
    private List<ScriptEnvVar> envVars;
}
