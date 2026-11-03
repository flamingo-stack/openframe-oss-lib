package com.openframe.data.document.rmm.script;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.function.UnaryOperator;

@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class ScriptEnvVar {

    private String name;

    private String value;

    private boolean secret;

    // true: value is the ciphertext of a secret. Only sealed() sets it and only revealed() clears it; a value that is
    // not secret or is empty is never encrypted
    private boolean encrypted;

    public static List<ScriptEnvVar> sealAll(List<ScriptEnvVar> envVars, UnaryOperator<String> encrypt) {
        return envVars == null ? null : envVars.stream().map(envVar -> envVar.sealed(encrypt)).toList();
    }

    public static List<ScriptEnvVar> revealAll(List<ScriptEnvVar> envVars, UnaryOperator<String> decrypt) {
        return envVars == null ? null : envVars.stream().map(envVar -> envVar.revealed(decrypt)).toList();
    }

    public ScriptEnvVar sealed(UnaryOperator<String> encrypt) {
        if (!secret || encrypted || value == null || value.isEmpty()) {
            return this;
        }
        String ciphertext = encrypt.apply(value);
        return toBuilder().value(ciphertext).encrypted(true).build();
    }

    public ScriptEnvVar revealed(UnaryOperator<String> decrypt) {
        if (!encrypted) {
            return this;
        }
        String plaintext = decrypt.apply(value);
        return toBuilder().value(plaintext).encrypted(false).build();
    }
}
