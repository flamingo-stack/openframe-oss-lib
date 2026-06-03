package com.openframe.api.mapper;

import com.openframe.api.dto.script.ScriptEnvVarInput;
import com.openframe.api.dto.script.UpdateScriptInput;
import com.openframe.data.document.rmm.Script;
import com.openframe.data.document.rmm.ScriptEnvVar;
import com.openframe.data.document.rmm.ScriptPlatform;
import com.openframe.data.document.rmm.ScriptShell;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies the PUT semantics of {@link ScriptMapper#updateEntity(Script, UpdateScriptInput)}:
 * every writable field on the input is written through to the entity,
 * including {@code null}s which must clear previously-set values.
 *
 * <p>{@code ScriptServiceTest} mocks the mapper, so the actual overwrite
 * behaviour is exercised here against the real mapper instance.
 */
class ScriptMapperTest {

    private final ScriptMapper mapper = new ScriptMapper();

    @Test
    @DisplayName("updateEntity: PUT semantics — explicit nulls on input clear the corresponding fields on the entity")
    void updateEntity_nullsInInput_clearFieldsOnEntity() {
        Script existing = fullyPopulated();

        UpdateScriptInput allNull = new UpdateScriptInput();
        // All fields default to null on a freshly-constructed UpdateScriptInput.

        mapper.updateEntity(existing, allNull);

        assertThat(existing.getName()).isNull();
        assertThat(existing.getDescription()).isNull();
        assertThat(existing.getShell()).isNull();
        assertThat(existing.getScriptBody()).isNull();
        assertThat(existing.getTag()).isNull();
        assertThat(existing.getSupportedPlatforms()).isNull();
        assertThat(existing.getDefaultTimeoutSeconds()).isNull();
        assertThat(existing.getDefaultArgs()).isNull();
        assertThat(existing.getEnvVars()).isNull();
    }

    @Test
    @DisplayName("updateEntity: fields not on UpdateScriptInput (id, tenantId, status) are intentionally untouched")
    void updateEntity_doesNotTouchInternalFields() {
        Script existing = fullyPopulated();
        String originalId = existing.getId();
        String originalTenantId = existing.getTenantId();

        UpdateScriptInput emptyInput = new UpdateScriptInput();
        mapper.updateEntity(existing, emptyInput);

        assertThat(existing.getId()).isEqualTo(originalId);
        assertThat(existing.getTenantId()).isEqualTo(originalTenantId);
    }

    @Test
    @DisplayName("updateEntity: a fully populated input overwrites every writable field on the entity")
    void updateEntity_fullyPopulatedInput_overwritesAllFields() {
        Script existing = fullyPopulated();

        UpdateScriptInput input = new UpdateScriptInput();
        input.setName("new-name");
        input.setDescription("new-description");
        input.setShell(ScriptShell.BASH);
        input.setScriptBody("echo new");
        input.setTag("new-tag");
        input.setSupportedPlatforms(List.of(ScriptPlatform.LINUX));
        input.setDefaultTimeoutSeconds(99);
        input.setDefaultArgs(List.of("--new"));
        input.setEnvVars(List.of(
                ScriptEnvVarInput.builder().name("NEW_VAR").value("v").secret(false).build()
        ));

        mapper.updateEntity(existing, input);

        assertThat(existing.getName()).isEqualTo("new-name");
        assertThat(existing.getDescription()).isEqualTo("new-description");
        assertThat(existing.getShell()).isEqualTo(ScriptShell.BASH);
        assertThat(existing.getScriptBody()).isEqualTo("echo new");
        assertThat(existing.getTag()).isEqualTo("new-tag");
        assertThat(existing.getSupportedPlatforms()).containsExactly(ScriptPlatform.LINUX);
        assertThat(existing.getDefaultTimeoutSeconds()).isEqualTo(99);
        assertThat(existing.getDefaultArgs()).containsExactly("--new");
        assertThat(existing.getEnvVars())
                .singleElement()
                .extracting(ScriptEnvVar::getName, ScriptEnvVar::getValue, ScriptEnvVar::isSecret)
                .containsExactly("NEW_VAR", "v", false);
    }

    @Test
    @DisplayName("updateEntity: an empty list explicitly clears a previously-populated list field — distinct from null but semantically the same end-state for read APIs")
    void updateEntity_emptyListInput_clearsListField() {
        Script existing = fullyPopulated();

        UpdateScriptInput input = new UpdateScriptInput();
        input.setDefaultArgs(List.of());
        input.setSupportedPlatforms(List.of());
        input.setEnvVars(List.of());

        mapper.updateEntity(existing, input);

        assertThat(existing.getDefaultArgs()).isEmpty();
        assertThat(existing.getSupportedPlatforms()).isEmpty();
        assertThat(existing.getEnvVars()).isEmpty();
    }

    private static Script fullyPopulated() {
        return Script.builder()
                .id("65f4a8000000000000000001")
                .tenantId("tenant-1")
                .name("Restart Spooler")
                .description("Reboot the printer spooler")
                .shell(ScriptShell.POWERSHELL)
                .scriptBody("Restart-Service -Name spooler")
                .tag("maintenance")
                .supportedPlatforms(List.of(ScriptPlatform.WINDOWS))
                .defaultTimeoutSeconds(60)
                .defaultArgs(List.of("spooler"))
                .envVars(List.of(
                        ScriptEnvVar.builder().name("LOG_LEVEL").value("INFO").secret(false).build()
                ))
                .build();
    }
}
