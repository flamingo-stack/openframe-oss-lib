package com.openframe.api.mapper;

import com.openframe.api.dto.rmm.script.ScriptEnvVarInput;
import com.openframe.data.document.rmm.ScriptEnvVar;

import java.util.List;

public final class ScriptEnvVarMapper {

    private ScriptEnvVarMapper() {
    }

    public static List<ScriptEnvVar> toEntity(List<ScriptEnvVarInput> input) {
        if (input == null) {
            return null;
        }
        return input.stream()
                .map(e -> ScriptEnvVar.builder()
                        .name(e.getName())
                        .value(e.getValue())
                        .secret(e.isSecret())
                        .build())
                .toList();
    }
}
