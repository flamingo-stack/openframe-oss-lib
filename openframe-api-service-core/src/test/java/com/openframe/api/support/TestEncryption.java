package com.openframe.api.support;

import com.google.crypto.tink.KeysetHandle;
import com.google.crypto.tink.aead.AeadConfig;
import com.google.crypto.tink.aead.PredefinedAeadParameters;
import com.openframe.api.mapper.ScriptSecretSealer;
import com.openframe.core.crypto.service.EncryptionContext;
import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.data.service.TenantIdProvider;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.support.StaticListableBeanFactory;

import java.security.GeneralSecurityException;
import java.util.Map;

import static com.openframe.core.crypto.service.SecretPurpose.SCRIPT_ENV_VAR;

// one test keyset for every test that seals or reveals script secrets; the pod belongs to TENANT
public final class TestEncryption {

    public static final String TENANT = "tenant-1";
    public static final EncryptionContext SCRIPT_CONTEXT = EncryptionContext.forTenant(TENANT, SCRIPT_ENV_VAR);
    public static final EncryptionService SERVICE = tinkService();

    private TestEncryption() {
    }

    public static EncryptionService tinkService() {
        try {
            AeadConfig.register();
            return EncryptionService.withKeyset(KeysetHandle.generateNew(PredefinedAeadParameters.AES256_GCM), true, null, null);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    public static TenantIdProvider tenant() {
        return tenant(TENANT);
    }

    public static TenantIdProvider tenant(String tenantId) {
        return () -> tenantId;
    }

    // a script secret as this pod stores it
    public static String seal(String plain) {
        return SERVICE.encrypt(plain, SCRIPT_CONTEXT);
    }

    public static String reveal(String ciphertext) {
        return SERVICE.decrypt(ciphertext, SCRIPT_CONTEXT);
    }

    public static ObjectProvider<EncryptionService> service() {
        StaticListableBeanFactory beans = new StaticListableBeanFactory(Map.of("encryptionService", SERVICE));
        return beans.getBeanProvider(EncryptionService.class);
    }

    // a service without the encryption config: nothing to reveal with
    public static ObjectProvider<EncryptionService> noService() {
        StaticListableBeanFactory beans = new StaticListableBeanFactory();
        return beans.getBeanProvider(EncryptionService.class);
    }

    public static ObjectProvider<ScriptSecretSealer> sealerOn() {
        ScriptSecretSealer sealer = new ScriptSecretSealer(SERVICE, tenant());
        StaticListableBeanFactory beans = new StaticListableBeanFactory(Map.of("sealer", sealer));
        return beans.getBeanProvider(ScriptSecretSealer.class);
    }

    public static ObjectProvider<ScriptSecretSealer> sealerOff() {
        StaticListableBeanFactory beans = new StaticListableBeanFactory();
        return beans.getBeanProvider(ScriptSecretSealer.class);
    }
}
