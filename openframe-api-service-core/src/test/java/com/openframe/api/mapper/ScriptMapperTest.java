package com.openframe.api.mapper;

import com.openframe.api.support.TestEncryption;
import com.openframe.api.dto.rmm.script.CreateScriptInput;
import com.openframe.api.dto.rmm.script.ScriptEnvVarInput;
import com.openframe.api.dto.rmm.script.ScriptResponse;
import com.openframe.api.dto.rmm.script.UpdateScriptInput;
import com.openframe.core.crypto.service.EncryptionContext;
import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.core.exception.EncryptionException;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.script.ScriptCreationSource;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.document.rmm.script.ScriptEnvVar;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.script.ScriptShell;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static com.openframe.data.document.rmm.script.ScriptStatus.ACTIVE;
import static com.openframe.data.document.rmm.script.ScriptStatus.ARCHIVED;
import static com.openframe.core.crypto.service.SecretPurpose.AGENT_LOG_KEY;
import static com.openframe.core.crypto.service.SecretPurpose.SCRIPT_ENV_VAR;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Verifies the PUT semantics of {@link ScriptMapper#updateEntity(Script, UpdateScriptInput)}:
 * every writable field on the input is written through to the entity,
 * including {@code null}s which must clear previously-set values.
 *
 * <p>{@code ScriptServiceTest} mocks the mapper, so the actual overwrite
 * behaviour is exercised here against the real mapper instance.
 */
class ScriptMapperTest {

    private final EncryptionService encryptionService = TestEncryption.SERVICE;
    private final ScriptMapper mapper = new ScriptMapper(TestEncryption.service(), TestEncryption.sealerOn(),
            TestEncryption.tenant());

    @Test
    @DisplayName("no encryption config: a script with no encrypted value still maps both ways")
    void noEncryptionService_plainScript_mapsWithoutIt() {
        ScriptMapper mapperWithoutKey = new ScriptMapper(TestEncryption.noService(), TestEncryption.sealerOff(),
                TestEncryption.tenant());
        CreateScriptInput input = new CreateScriptInput();
        input.setEnvVars(List.of(ScriptEnvVarInput.builder().name("TOKEN").value("s3cr3t").secret(true).build()));

        Script entity = mapperWithoutKey.toEntity("tenant-1", input);
        String value = mapperWithoutKey.toResponse(entity).getEnvVars().get(0).getValue();

        assertThat(value).isEqualTo("s3cr3t");
    }

    @Test
    @DisplayName("encryption off: a secret is stored as given, and an already encrypted one still comes back plain")
    void encryptionOff_storesPlain_stillDecrypts() {
        ScriptMapper plainMapper = new ScriptMapper(TestEncryption.service(), TestEncryption.sealerOff(),
                TestEncryption.tenant());
        CreateScriptInput input = new CreateScriptInput();
        input.setEnvVars(List.of(ScriptEnvVarInput.builder().name("TOKEN").value("s3cr3t").secret(true).build()));

        ScriptEnvVar stored = plainMapper.toEntity("tenant-1", input).getEnvVars().get(0);
        assertThat(stored.isEncrypted()).isFalse();
        assertThat(stored.getValue()).isEqualTo("s3cr3t");

        Script sealedEarlier = Script.builder().envVars(List.of(ScriptEnvVar.builder()
                .name("TOKEN").value("s3cr3t").secret(true).build()
                .sealed(TestEncryption::seal))).build();
        assertThat(plainMapper.toResponse(sealedEarlier).getEnvVars().get(0).getValue()).isEqualTo("s3cr3t");
    }

    @Test
    @DisplayName("toEntity: a secret is stored encrypted, a plain var stays plain")
    void toEntity_encryptsSecretsOnly() {
        CreateScriptInput input = new CreateScriptInput();
        input.setEnvVars(List.of(
                ScriptEnvVarInput.builder().name("TOKEN").value("s3cr3t").secret(true).build(),
                ScriptEnvVarInput.builder().name("REGION").value("eu").secret(false).build()));

        List<ScriptEnvVar> stored = mapper.toEntity("tenant-1", input).getEnvVars();

        assertThat(stored.get(0).isEncrypted()).isTrue();
        assertThat(stored.get(0).getValue()).isNotEqualTo("s3cr3t");
        assertThat(TestEncryption.reveal(stored.get(0).getValue())).isEqualTo("s3cr3t");
        assertThat(stored.get(1).isEncrypted()).isFalse();
        assertThat(stored.get(1).getValue()).isEqualTo("eu");
    }

    @Test
    @DisplayName("toEntity: a secret is sealed for the pod's tenant and the script-env-var purpose, unreadable under any other context")
    void toEntity_sealsForThePodTenantAndScriptPurpose() {
        CreateScriptInput input = new CreateScriptInput();
        input.setEnvVars(List.of(ScriptEnvVarInput.builder().name("TOKEN").value("s3cr3t").secret(true).build()));

        String stored = mapper.toEntity(TestEncryption.TENANT, input).getEnvVars().get(0).getValue();

        assertThat(stored).doesNotContain("s3cr3t");
        assertThat(encryptionService.decrypt(stored, EncryptionContext.forTenant(TestEncryption.TENANT, SCRIPT_ENV_VAR)))
                .isEqualTo("s3cr3t");
        assertThatThrownBy(() -> encryptionService.decrypt(stored, EncryptionContext.forTenant("tenant-2", SCRIPT_ENV_VAR)))
                .isInstanceOf(EncryptionException.class);
        assertThatThrownBy(() -> encryptionService.decrypt(stored, EncryptionContext.forTenant(TestEncryption.TENANT, AGENT_LOG_KEY)))
                .isInstanceOf(EncryptionException.class);
    }

    @Test
    @DisplayName("toEntity: the pod's tenant is the context even when the caller passes another tenant id")
    void toEntity_podTenantWinsOverTheArgument() {
        CreateScriptInput input = new CreateScriptInput();
        input.setEnvVars(List.of(ScriptEnvVarInput.builder().name("TOKEN").value("s3cr3t").secret(true).build()));

        String stored = mapper.toEntity("tenant-2", input).getEnvVars().get(0).getValue();

        assertThat(TestEncryption.reveal(stored)).isEqualTo("s3cr3t");
    }

    @Test
    @DisplayName("toResponse: a secret sealed for another tenant fails instead of coming back")
    void toResponse_secretOfAnotherTenant_fails() {
        Script entity = Script.builder().tenantId(TestEncryption.TENANT).envVars(List.of(
                ScriptEnvVar.builder().name("TOKEN").value("s3cr3t").secret(true).build()
                        .sealed(v -> encryptionService.encrypt(v, EncryptionContext.forTenant("tenant-2", SCRIPT_ENV_VAR)))))
                .build();

        assertThatThrownBy(() -> mapper.toResponse(entity)).isInstanceOf(EncryptionException.class);
    }

    @Test
    @DisplayName("toResponse: a secret sealed for another purpose fails instead of coming back")
    void toResponse_secretOfAnotherPurpose_fails() {
        Script entity = Script.builder().tenantId(TestEncryption.TENANT).envVars(List.of(
                ScriptEnvVar.builder().name("TOKEN").value("s3cr3t").secret(true).build()
                        .sealed(v -> encryptionService.encrypt(v, EncryptionContext.forTenant(TestEncryption.TENANT, AGENT_LOG_KEY)))))
                .build();

        assertThatThrownBy(() -> mapper.toResponse(entity)).isInstanceOf(EncryptionException.class);
    }

    @Test
    @DisplayName("toResponse: a stored secret is decrypted — the response carries the plain value dispatch sends")
    void toResponse_decryptsSecrets() {
        Script entity = Script.builder().envVars(List.of(
                ScriptEnvVar.builder().name("TOKEN").value("s3cr3t").secret(true).build()
                        .sealed(TestEncryption::seal))).build();

        ScriptResponse response = mapper.toResponse(entity);

        assertThat(response.getEnvVars()).singleElement()
                .extracting(ScriptEnvVarInput::getValue, ScriptEnvVarInput::isSecret)
                .containsExactly("s3cr3t", true);
    }

    @Test
    @DisplayName("updateEntity: a kept secret (no value sent) keeps its stored ciphertext — never encrypted twice")
    void updateEntity_keptSecretIsNotEncryptedTwice() {
        ScriptEnvVar stored = ScriptEnvVar.builder().name("TOKEN").value("s3cr3t").secret(true).build()
                .sealed(TestEncryption::seal);
        Script existing = Script.builder().envVars(List.of(stored)).build();
        UpdateScriptInput input = new UpdateScriptInput();
        input.setEnvVars(List.of(ScriptEnvVarInput.builder().name("TOKEN").secret(true).build()));

        mapper.updateEntity(existing, input);

        ScriptEnvVar kept = existing.getEnvVars().get(0);
        assertThat(kept.getValue()).isEqualTo(stored.getValue());
        assertThat(kept.isEncrypted()).isTrue();
        assertThat(TestEncryption.reveal(kept.getValue())).isEqualTo("s3cr3t");
    }

    @Test
    @DisplayName("toEntity: maps every CreateScriptInput field onto a new Script, including shell and privilegeLevel")
    void toEntity_mapsAllFieldsIncludingPrivilegeLevel() {
        CreateScriptInput input = new CreateScriptInput();
        input.setName("Backup");
        input.setDescription("nightly backup");
        input.setShell(ScriptShell.BASH);
        input.setPrivilegeLevel(PrivilegeLevel.ADMIN);
        input.setScriptBody("tar -czf backup.tgz /data");
        input.setSupportedPlatforms(List.of(OsType.MAC_OS));
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
        assertThat(entity.getSupportedPlatforms()).containsExactly(OsType.MAC_OS);
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
        input.setSupportedPlatforms(List.of(OsType.MAC_OS));
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
        assertThat(existing.getSupportedPlatforms()).containsExactly(OsType.MAC_OS);
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
    @DisplayName("updateEntity: a secret input with a null value falls back to the previously stored value — the FE can round-trip masked env vars without re-typing every secret")
    void updateEntity_secretWithNullValue_keepsStoredValue() {
        Script existing = fullyPopulated();
        existing.setEnvVars(List.of(
                ScriptEnvVar.builder().name("PLAIN").value("prod").secret(false).build(),
                ScriptEnvVar.builder().name("TOKEN").value("stored-secret").secret(true).build()));

        UpdateScriptInput input = new UpdateScriptInput();
        input.setEnvVars(List.of(
                // FE re-sends PLAIN with a new value; TOKEN comes back masked (value=null).
                ScriptEnvVarInput.builder().name("PLAIN").value("staging").secret(false).build(),
                ScriptEnvVarInput.builder().name("TOKEN").value(null).secret(true).build()));

        mapper.updateEntity(existing, input);

        assertThat(revealed(existing.getEnvVars()))
                .extracting(ScriptEnvVar::getName, ScriptEnvVar::getValue, ScriptEnvVar::isSecret)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("PLAIN", "staging", false),
                        org.assertj.core.groups.Tuple.tuple("TOKEN", "stored-secret", true));
    }

    @Test
    @DisplayName("updateEntity: a secret input with an explicit new value replaces the stored value — 'Replace value' flow")
    void updateEntity_secretWithNewValue_replacesStoredValue() {
        Script existing = fullyPopulated();
        existing.setEnvVars(List.of(
                ScriptEnvVar.builder().name("TOKEN").value("old-secret").secret(true).build()));

        UpdateScriptInput input = new UpdateScriptInput();
        input.setEnvVars(List.of(
                ScriptEnvVarInput.builder().name("TOKEN").value("new-secret").secret(true).build()));

        mapper.updateEntity(existing, input);

        assertThat(revealed(existing.getEnvVars()))
                .singleElement()
                .extracting(ScriptEnvVar::getValue)
                .isEqualTo("new-secret");
    }

    @Test
    @DisplayName("updateEntity: a NON-secret input with a null value is rejected — non-secret vars must always carry a value")
    void updateEntity_nonSecretWithNullValue_rejected() {
        Script existing = fullyPopulated();

        UpdateScriptInput input = new UpdateScriptInput();
        input.setEnvVars(List.of(
                ScriptEnvVarInput.builder().name("PLAIN").value(null).secret(false).build()));

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> mapper.updateEntity(existing, input))
                .isInstanceOf(com.openframe.core.exception.BadRequestException.class)
                .hasMessageContaining("PLAIN");
    }

    @Test
    @DisplayName("updateEntity: a secret input with a null value and no stored value is rejected — nothing to fall back to")
    void updateEntity_secretWithNullValueAndNoStore_rejected() {
        Script existing = fullyPopulated();
        existing.setEnvVars(List.of());   // no prior TOKEN to keep

        UpdateScriptInput input = new UpdateScriptInput();
        input.setEnvVars(List.of(
                ScriptEnvVarInput.builder().name("TOKEN").value(null).secret(true).build()));

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> mapper.updateEntity(existing, input))
                .isInstanceOf(com.openframe.core.exception.BadRequestException.class)
                .hasMessageContaining("TOKEN");
    }

    @Test
    @DisplayName("toResponse: maps the status enum to its name")
    void toResponse_mapsStatusName() {
        Script entity = fullyPopulated();
        entity.setStatus(ARCHIVED);

        ScriptResponse response = mapper.toResponse(entity);

        assertThat(response.getStatus()).isEqualTo(ARCHIVED);
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

        assertThat(response.getStatus()).isEqualTo(ACTIVE);
    }

    @Test
    @DisplayName("toResponse: a null creationSource (script created before the field existed) reads as MANUAL so the non-null schema field is never violated")
    void toResponse_nullCreationSource_fallsBackToManual() {
        // setup
        Script entity = fullyPopulated();
        entity.setCreationSource(null);

        // execution
        ScriptResponse response = mapper.toResponse(entity);

        // verifications
        assertThat(response.getCreationSource()).isEqualTo(ScriptCreationSource.MANUAL);
    }

    @Test
    @DisplayName("toResponse: carries the stored creationSource through")
    void toResponse_mapsCreationSource() {
        // setup
        Script entity = fullyPopulated();
        entity.setCreationSource(ScriptCreationSource.AI_ASSISTANT);

        // execution
        ScriptResponse response = mapper.toResponse(entity);

        // verifications
        assertThat(response.getCreationSource()).isEqualTo(ScriptCreationSource.AI_ASSISTANT);
    }

    private List<ScriptEnvVar> revealed(List<ScriptEnvVar> envVars) {
        return ScriptEnvVar.revealAll(envVars, TestEncryption::reveal);
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
                .supportedPlatforms(List.of(OsType.WINDOWS))
                .defaultTimeoutSeconds(60)
                .defaultArgs(List.of("spooler"))
                .envVars(List.of(
                        ScriptEnvVar.builder().name("LOG_LEVEL").value("INFO").secret(false).build()
                ))
                .build();
    }
}
