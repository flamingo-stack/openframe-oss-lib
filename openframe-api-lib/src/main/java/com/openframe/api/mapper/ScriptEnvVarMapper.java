package com.openframe.api.mapper;

import com.openframe.api.dto.rmm.script.ScriptEnvVarInput;
import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.rmm.script.ScriptEnvVar;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public final class ScriptEnvVarMapper {

    private ScriptEnvVarMapper() {
    }

    public static void validate(List<ScriptEnvVarInput> input) {
        if (input == null) {
            return;
        }
        for (ScriptEnvVarInput e : input) {
            if (e.getValue() == null && !e.isSecret()) {
                throw new BadRequestException("Env var '" + e.getName() + "' must have a value");
            }
        }
    }

    public static List<ScriptEnvVar> toEntity(List<ScriptEnvVarInput> input) {
        return toEntity(input, null);
    }

    public static List<ScriptEnvVar> toEntity(List<ScriptEnvVarInput> input, List<ScriptEnvVar> existing) {
        if (input == null) {
            return null;
        }
        Map<String, String> stored = existing == null ? Map.of() : existing.stream()
                .filter(v -> v.getName() != null)
                .collect(Collectors.toMap(ScriptEnvVar::getName,
                        v -> v.getValue() == null ? "" : v.getValue(), (a, b) -> b));
        return input.stream()
                .map(e -> ScriptEnvVar.builder()
                        .name(e.getName())
                        .value(resolveValue(e, stored))
                        .secret(e.isSecret())
                        .build())
                .toList();
    }

    private static String resolveValue(ScriptEnvVarInput e, Map<String, String> stored) {
        if (e.getValue() != null) {
            return e.getValue();
        }
        if (e.isSecret()) {
            String kept = stored.get(e.getName());
            if (kept == null) {
                throw new BadRequestException("Secret env var '" + e.getName()
                        + "' has no stored value to keep — provide a value");
            }
            return kept;
        }
        throw new BadRequestException("Env var '" + e.getName() + "' must have a value");
    }

    public static List<ScriptEnvVarInput> mask(List<ScriptEnvVarInput> envVars) {
        if (envVars == null) {
            return null;
        }
        return envVars.stream()
                .map(ScriptEnvVarMapper::maskSingle)
                .toList();
    }

    private static ScriptEnvVarInput maskSingle(ScriptEnvVarInput v) {
        String name = v.getName();
        boolean secret = v.isSecret();
        String value = secret ? null : v.getValue();
        return ScriptEnvVarInput.builder()
                .name(name)
                .value(value)
                .secret(secret)
                .build();
    }
}
