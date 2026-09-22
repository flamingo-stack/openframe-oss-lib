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
                .map(ScriptEnvVarMapper::toEntitySingle)
                .toList();
    }

    @SafeVarargs
    public static List<ScriptEnvVar> toEntityResolvingSecrets(List<ScriptEnvVarInput> input,
                                                              List<ScriptEnvVar>... fallbackSources) {
        if (input == null) {
            return null;
        }
        return input.stream()
                .map(e -> resolveSingle(e, fallbackSources))
                .toList();
    }

    private static ScriptEnvVar toEntitySingle(ScriptEnvVarInput e) {
        String name = e.getName();
        String value = e.getValue();
        boolean secret = e.isSecret();
        return ScriptEnvVar.builder()
                .name(name)
                .value(value)
                .secret(secret)
                .build();
    }

    private static ScriptEnvVar resolveSingle(ScriptEnvVarInput e, List<ScriptEnvVar>[] fallbacks) {
        String name = e.getName();
        boolean secret = e.isSecret();
        String value = e.getValue();
        if (hasText(value)) {
            return build(name, value, secret);
        }
        if (!secret) {
            throw new BadRequestException("Env var '" + name + "' must have a value");
        }
        for (List<ScriptEnvVar> source : fallbacks) {
            String resolved = lookup(source, name);
            if (hasText(resolved)) {
                return build(name, resolved, true);
            }
        }
        throw new BadRequestException(
                "Secret env var '" + name + "' has no stored value to keep — provide a value");
    }

    private static ScriptEnvVar build(String name, String value, boolean secret) {
        return ScriptEnvVar.builder()
                .name(name)
                .value(value)
                .secret(secret)
                .build();
    }

    private static String lookup(List<ScriptEnvVar> source, String name) {
        if (source == null) {
            return null;
        }
        for (ScriptEnvVar v : source) {
            if (name.equals(v.getName())) {
                return v.getValue();
            }
        }
        return null;
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
        // Extract into named locals so PMD's NoMethodCallAsArgument (OFJAVA-002) does not fire on
        // the inline builder chain.
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
