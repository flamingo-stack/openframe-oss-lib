package com.openframe.data.document.rmm;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScheduledScriptCustomParams {

    private String scriptId;
    private List<String> args;
    private List<ScriptEnvVar> envVars;
}
