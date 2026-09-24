package com.openframe.api.mapper;

import com.openframe.api.dto.rmm.script.ScriptEnvVarInput;
import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.rmm.script.ScriptEnvVar;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ScriptEnvVarMapperTest {

    @Test
    @DisplayName("validate: a non-secret with no value is rejected; an empty value and a null secret are allowed")
    void validate_rejectsOnlyNonSecretNull() {
        assertThatThrownBy(() -> ScriptEnvVarMapper.validate(List.of(in("FOO", null, false))))
                .isInstanceOf(BadRequestException.class);

        // FOO= (empty) is a real value, and an untouched masked secret arrives as null — both pass.
        ScriptEnvVarMapper.validate(List.of(in("FOO", "", false), in("TOKEN", null, true)));
    }

    @Test
    @DisplayName("toEntity: an untouched secret (null value) inherits the stored value under the same name")
    void toEntity_keepsSecretFromExisting() {
        List<ScriptEnvVar> existing = List.of(entity("TOKEN", "s3cr3t", true), entity("HOST", "old", false));

        List<ScriptEnvVar> result = ScriptEnvVarMapper.toEntity(
                List.of(in("TOKEN", null, true), in("HOST", "new", false)), existing);

        assertThat(result).extracting(ScriptEnvVar::getName, ScriptEnvVar::getValue, ScriptEnvVar::isSecret)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("TOKEN", "s3cr3t", true),   // kept
                        org.assertj.core.groups.Tuple.tuple("HOST", "new", false));     // overwritten
    }

    @Test
    @DisplayName("toEntity: a secret with a fresh value overwrites, and an empty value is preserved as empty")
    void toEntity_freshValueAndEmpty() {
        List<ScriptEnvVar> existing = List.of(entity("TOKEN", "old", true));

        List<ScriptEnvVar> result = ScriptEnvVarMapper.toEntity(
                List.of(in("TOKEN", "rotated", true), in("EMPTY", "", false)), existing);

        assertThat(result).extracting(ScriptEnvVar::getValue).containsExactly("rotated", "");
    }

    @Test
    @DisplayName("toEntity: a null secret with nothing stored to keep is rejected")
    void toEntity_secretNullNoExisting_rejected() {
        assertThatThrownBy(() -> ScriptEnvVarMapper.toEntity(List.of(in("TOKEN", null, true)), null))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("TOKEN");
    }

    @Test
    @DisplayName("toEntity: a non-secret with no value is rejected even when existing values are present")
    void toEntity_nonSecretNull_rejected() {
        List<ScriptEnvVar> existing = List.of(entity("FOO", "was-here", false));
        assertThatThrownBy(() -> ScriptEnvVarMapper.toEntity(List.of(in("FOO", null, false)), existing))
                .isInstanceOf(BadRequestException.class);
    }

    private static ScriptEnvVarInput in(String name, String value, boolean secret) {
        return ScriptEnvVarInput.builder().name(name).value(value).secret(secret).build();
    }

    private static ScriptEnvVar entity(String name, String value, boolean secret) {
        return ScriptEnvVar.builder().name(name).value(value).secret(secret).build();
    }
}
