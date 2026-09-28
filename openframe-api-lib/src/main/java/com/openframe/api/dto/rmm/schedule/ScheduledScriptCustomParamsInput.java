package com.openframe.api.dto.rmm.schedule;

import com.openframe.api.dto.rmm.script.ScriptEnvVarInput;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScheduledScriptCustomParamsInput {

    @NotBlank
    private String scriptId;

    private List<String> args;

    @Valid
    private List<ScriptEnvVarInput> envVars;
}

