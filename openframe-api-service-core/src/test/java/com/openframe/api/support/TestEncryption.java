package com.openframe.api.support;

import com.openframe.api.mapper.ScriptSecretSealer;
import com.openframe.core.crypto.service.EncryptionService;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.support.StaticListableBeanFactory;

import java.util.Map;

// one test key for every test that seals or reveals script secrets
public final class TestEncryption {

    public static final EncryptionService SERVICE =
            new EncryptionService("test-encryption-password-of-32-chars!", "74f62c51327175b0");

    private TestEncryption() {
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
        ScriptSecretSealer sealer = new ScriptSecretSealer(SERVICE);
        StaticListableBeanFactory beans = new StaticListableBeanFactory(Map.of("sealer", sealer));
        return beans.getBeanProvider(ScriptSecretSealer.class);
    }

    public static ObjectProvider<ScriptSecretSealer> sealerOff() {
        StaticListableBeanFactory beans = new StaticListableBeanFactory();
        return beans.getBeanProvider(ScriptSecretSealer.class);
    }
}
