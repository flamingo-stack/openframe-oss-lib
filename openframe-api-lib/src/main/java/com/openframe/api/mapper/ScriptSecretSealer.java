package com.openframe.api.mapper;

import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.data.document.rmm.script.ScriptEnvVar;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@ConditionalOnProperty(value = "openframe.features.scripts.secret-encryption.enabled", havingValue = "true")
@RequiredArgsConstructor
public class ScriptSecretSealer {

    private final EncryptionService encryptionService;

    public List<ScriptEnvVar> seal(List<ScriptEnvVar> envVars) {
        return ScriptEnvVar.sealAll(envVars, encryptionService::encrypt);
    }
}
