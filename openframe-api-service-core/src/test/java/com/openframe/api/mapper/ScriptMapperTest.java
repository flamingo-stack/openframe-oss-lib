package com.openframe.api.mapper;

import com.openframe.api.dto.script.CreateScriptInput;
import com.openframe.api.dto.script.ScriptEnvVarInput;
import com.openframe.api.dto.script.ScriptResponse;
import com.openframe.api.dto.script.UpdateScriptInput;
import com.openframe.data.document.rmm.PrivilegeLevel;
import com.openframe.data.document.rmm.Script;
import com.openframe.data.document.rmm.ScriptEnvVar;
import com.openframe.data.document.rmm.ScriptPlatform;
import com.openframe.data.document.rmm.ScriptShell;
import com.openframe.data.document.rmm.ScriptStatus;
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
    @DisplayName("toEntity: maps every CreateScriptInput field onto a new Script, including shell and privilegeLevel")
    void toEntity_mapsAllFieldsIncludingPrivilegeLevel() {
        CreateScriptInput input = new CreateScriptInput();
        input.setName("Backup");
        input.setDescription("nightly backup");
        input.setShell(ScriptShell.BASH);
        input.setPrivilegeLevel(PrivilegeLevel.ADMIN);
        input.setScriptBody("tar -czf backup.tgz /data");
        input.setSupportedPlatforms(List.of(ScriptPlatform.LINUX));
        input.setDefaultTimeoutSeconds(120);
        input.setDefaultArgs(List.of("--full"));
        input.setEnvVars(List.of(
                ScriptEnvVarInput.builder().name("K").value("v").secret(false).build()));

        Script entity = mapper.toEntity("tenant-1", input);

        assertThat(entity.getTenantId()).isEqualTo("tenant-1");
        assertThat(entity.getName()).isEqualTo("Backup");
        assertThat(entity.getDescription()).isEqualTo("nightly backup");
        assertThat(entity.getShell()).isEqualTo(ScriptShell.BASH);
        assertThat(entity.getPrivilegeLevel()).isEqualTo(PrivilegeLevel.ADMIN);
        assertThat(entity.getScriptBody()).isEqualTo("tar -czf backup.tgz /data");
        assertThat(entity.getSupportedPlatforms()).containsExactly(ScriptPlatform.LINUX);
        assertThat(entity.getDefaultTimeoutSeconds()).isEqualTo(120);
        assertThat(entity.getDefaultArgs()).containsExactly("--full");
        assertThat(entity.getEnvVars())
                .singleElement()
                .extracting(ScriptEnvVar::getName, ScriptEnvVar::getValue, ScriptEnvVar::isSecret)
                .containsExactly("K", "v", false);
    }

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
        assertThat(existing.getPrivilegeLevel()).isNull();
        assertThat(existing.getScriptBody()).isNull();
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
        input.setPrivilegeLevel(PrivilegeLevel.ADMIN);
        input.setScriptBody("echo new");
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
        assertThat(existing.getPrivilegeLevel()).isEqualTo(PrivilegeLevel.ADMIN);
        assertThat(existing.getScriptBody()).isEqualTo("echo new");
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

    @Test
    @DisplayName("toResponse: maps the status enum to its name")
    void toResponse_mapsStatusName() {
        Script entity = fullyPopulated();
        entity.setStatus(ScriptStatus.ARCHIVED);

        ScriptResponse response = mapper.toResponse(entity);

        assertThat(response.getStatus()).isEqualTo("ARCHIVED");
    }

    @Test
    @DisplayName("toResponse: carries the privilegeLevel enum through")
    void toResponse_mapsPrivilegeLevel() {
        Script entity = fullyPopulated();
        entity.setPrivilegeLevel(PrivilegeLevel.ADMIN);

        ScriptResponse response = mapper.toResponse(entity);

        assertThat(response.getPrivilegeLevel()).isEqualTo(PrivilegeLevel.ADMIN);
        // createdBy is carried through for the author resolver.
        assertThat(response.getCreatedBy()).isEqualTo("user-1");
    }

    @Test
    @DisplayName("toResponse: a null privilegeLevel falls back to USER (least privilege) so the non-null PrivilegeLevel! schema field is never violated")
    void toResponse_nullPrivilegeLevel_fallsBackToUser() {
        Script entity = fullyPopulated();
        entity.setPrivilegeLevel(null);

        ScriptResponse response = mapper.toResponse(entity);

        assertThat(response.getPrivilegeLevel()).isEqualTo(PrivilegeLevel.USER);
    }

    @Test
    @DisplayName("toResponse: a null status falls back to ACTIVE so the non-null ScriptStatus! schema field is never violated")
    void toResponse_nullStatus_fallsBackToActive() {
        Script entity = fullyPopulated();
        entity.setStatus(null);

        ScriptResponse response = mapper.toResponse(entity);

        assertThat(response.getStatus()).isEqualTo("ACTIVE");
    }

    private static Script fullyPopulated() {
        return Script.builder()
                .id("65f4a8000000000000000001")
                .tenantId("tenant-1")
                .name("Restart Spooler")
                .description("Reboot the printer spooler")
                .shell(ScriptShell.POWERSHELL)
                .privilegeLevel(PrivilegeLevel.USER)
                .scriptBody("Restart-Service -Name spooler")
                .createdBy("user-1")
                .supportedPlatforms(List.of(ScriptPlatform.WINDOWS))
                .defaultTimeoutSeconds(60)
                .defaultArgs(List.of("spooler"))
                .envVars(List.of(
                        ScriptEnvVar.builder().name("LOG_LEVEL").value("INFO").secret(false).build()
                ))
                .build();
    }
}
