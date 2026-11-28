package com.openframe.api.mapper;

import com.google.crypto.tink.KeysetHandle;
import com.google.crypto.tink.aead.AeadConfig;
import com.google.crypto.tink.aead.PredefinedAeadParameters;
import com.openframe.api.dto.rmm.script.ScriptEnvVarInput;
import com.openframe.core.crypto.service.EncryptionContext;
import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.core.exception.EncryptionException;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.document.rmm.script.ScriptEnvVar;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.support.StaticListableBeanFactory;

import java.security.GeneralSecurityException;
import java.util.List;
import java.util.Map;

import static com.openframe.core.crypto.service.SecretPurpose.SCRIPT_ENV_VAR;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ScriptMapperRevealTest {

    private static final String TENANT = "tenant-1";

    private final EncryptionService encryptionService = tinkEncryption();
    private final TenantIdProvider tenantIdProvider = () -> TENANT;
    private final ScriptMapper mapper = new ScriptMapper(provider(encryptionService), noSealer(), tenantIdProvider);

    @Test
    @DisplayName("toResponse: a secret sealed for the pod's tenant comes back in clear")
    void toResponse_secretOfThePodTenant_revealed() {
        Script entity = scriptWithSecretSealedFor(TENANT);

        List<ScriptEnvVarInput> envVars = mapper.toResponse(entity).getEnvVars();

        assertThat(envVars).singleElement()
                .extracting(ScriptEnvVarInput::getName, ScriptEnvVarInput::getValue, ScriptEnvVarInput::isSecret)
                .containsExactly("TOKEN", "s3cr3t", true);
    }

    @Test
    @DisplayName("toResponse: a secret sealed for another tenant fails instead of coming back")
    void toResponse_secretOfAnotherTenant_fails() {
        Script entity = scriptWithSecretSealedFor("tenant-2");

        assertThatThrownBy(() -> mapper.toResponse(entity)).isInstanceOf(EncryptionException.class);
    }

    private Script scriptWithSecretSealedFor(String tenantId) {
        EncryptionContext context = EncryptionContext.forTenant(tenantId, SCRIPT_ENV_VAR);
        ScriptEnvVar secret = ScriptEnvVar.builder().name("TOKEN").value("s3cr3t").secret(true).build()
                .sealed(plain -> encryptionService.encrypt(plain, context));
        return Script.builder().tenantId(TENANT).envVars(List.of(secret)).build();
    }

    static EncryptionService tinkEncryption() {
        try {
            AeadConfig.register();
            return EncryptionService.withKeyset(KeysetHandle.generateNew(PredefinedAeadParameters.AES256_GCM), true, null, null);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    static ObjectProvider<EncryptionService> provider(EncryptionService service) {
        return new StaticListableBeanFactory(Map.of("encryptionService", service)).getBeanProvider(EncryptionService.class);
    }

    static ObjectProvider<ScriptSecretSealer> noSealer() {
        return new StaticListableBeanFactory().getBeanProvider(ScriptSecretSealer.class);
    }
}
