package com.openframe.api.mapper;

import com.openframe.api.dto.rmm.script.ScriptEnvVarInput;
import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.rmm.script.ScriptEnvVar;

import java.util.List;

import static org.springframework.util.StringUtils.hasText;

public final class ScriptEnvVarMapper {

    private ScriptEnvVarMapper() {
    }

    public static void validate(List<ScriptEnvVarInput> input) {
        if (input == null) {
            return;
        }
        for (ScriptEnvVarInput e : input) {
            if (!hasText(e.getValue())) {
                throw new BadRequestException("Env var '" + e.getName() + "' must have a value");
            }
        }
    }

    public static List<ScriptEnvVar> toEntity(List<ScriptEnvVarInput> input) {
        if (input == null) {
            return null;
        }
        validate(input);
        return input.stream()
                .map(e -> ScriptEnvVar.builder()
                        .name(e.getName())
                        .value(e.getValue())
                        .secret(e.isSecret())
                        .build())
                .toList();
    }

    public static List<ScriptEnvVarInput> mask(List<ScriptEnvVarInput> envVars) {
        if (envVars == null) {
            return null;
        }
        return envVars.stream()
                .map(v -> ScriptEnvVarInput.builder()
                        .name(v.getName())
                        .value(v.isSecret() ? null : v.getValue())
                        .secret(v.isSecret())
                        .build())
                .toList();
    }
}
