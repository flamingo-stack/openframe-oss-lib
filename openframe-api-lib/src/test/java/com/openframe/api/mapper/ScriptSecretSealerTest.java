package com.openframe.api.mapper;

import com.google.crypto.tink.KeysetHandle;
import com.google.crypto.tink.aead.AeadConfig;
import com.google.crypto.tink.aead.PredefinedAeadParameters;
import com.openframe.core.crypto.service.EncryptionContext;
import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.core.exception.EncryptionException;
import com.openframe.data.document.rmm.script.ScriptEnvVar;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.security.GeneralSecurityException;
import java.util.List;

import static com.openframe.core.crypto.service.SecretPurpose.SCRIPT_ENV_VAR;
import static com.openframe.core.crypto.service.SecretPurpose.SSO_CLIENT_SECRET;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ScriptSecretSealerTest {

    private static final String TENANT = "tenant-1";
    private static final EncryptionContext SCRIPT_CONTEXT = EncryptionContext.forTenant(TENANT, SCRIPT_ENV_VAR);

    private final EncryptionService encryptionService = tinkEncryption();
    private final TenantIdProvider tenantIdProvider = mock(TenantIdProvider.class);
    private final ScriptSecretSealer sealer = new ScriptSecretSealer(encryptionService, tenantIdProvider);

    private static EncryptionService tinkEncryption() {
        try {
            AeadConfig.register();
            return EncryptionService.withKeyset(KeysetHandle.generateNew(PredefinedAeadParameters.AES256_GCM), true, null, null);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    @Test
    @DisplayName("seal: a secret becomes ciphertext for the pod's tenant and the script-env-var purpose, a plain var stays")
    void seal_secretForThePodTenantAndScriptPurpose() {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
        ScriptEnvVar secret = ScriptEnvVar.builder().name("TOKEN").value("s3cr3t").secret(true).build();
        ScriptEnvVar plain = ScriptEnvVar.builder().name("REGION").value("eu").secret(false).build();

        List<ScriptEnvVar> sealed = sealer.seal(List.of(secret, plain));

        String stored = sealed.get(0).getValue();
        assertThat(sealed.get(0).isEncrypted()).isTrue();
        assertThat(stored).doesNotContain("s3cr3t");
        assertThat(encryptionService.decrypt(stored, SCRIPT_CONTEXT)).isEqualTo("s3cr3t");
        assertThat(sealed.get(1)).isSameAs(plain);
    }

    @Test
    @DisplayName("seal: the sealed value is unreadable for another tenant or another purpose")
    void seal_unreadableUnderAnotherContext() {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
        ScriptEnvVar secret = ScriptEnvVar.builder().name("TOKEN").value("s3cr3t").secret(true).build();

        String stored = sealer.seal(List.of(secret)).get(0).getValue();

        assertThatThrownBy(() -> encryptionService.decrypt(stored, EncryptionContext.forTenant("tenant-2", SCRIPT_ENV_VAR)))
                .isInstanceOf(EncryptionException.class);
        assertThatThrownBy(() -> encryptionService.decrypt(stored, EncryptionContext.forTenant(TENANT, SSO_CLIENT_SECRET)))
                .isInstanceOf(EncryptionException.class);
    }

    @Test
    @DisplayName("seal: follows the tenant the pod reports, not a fixed one")
    void seal_usesTheTenantFromTheProvider() {
        when(tenantIdProvider.getTenantId()).thenReturn("tenant-2");
        ScriptEnvVar secret = ScriptEnvVar.builder().name("TOKEN").value("s3cr3t").secret(true).build();

        String stored = sealer.seal(List.of(secret)).get(0).getValue();

        assertThat(encryptionService.decrypt(stored, EncryptionContext.forTenant("tenant-2", SCRIPT_ENV_VAR)))
                .isEqualTo("s3cr3t");
        assertThatThrownBy(() -> encryptionService.decrypt(stored, SCRIPT_CONTEXT)).isInstanceOf(EncryptionException.class);
    }

    @Test
    @DisplayName("seal: null stays null")
    void seal_nullStaysNull() {
        assertThat(sealer.seal(null)).isNull();
    }
}
