package com.openframe.api.mapper;

import com.openframe.core.crypto.service.EncryptionContext;
import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.data.document.rmm.script.ScriptEnvVar;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;

import static com.openframe.core.crypto.service.SecretPurpose.SCRIPT_ENV_VAR;

@Component
@ConditionalOnProperty(value = "openframe.features.scripts.secret-encryption.enabled", havingValue = "true")
@RequiredArgsConstructor
public class ScriptSecretSealer {

    private final EncryptionService encryptionService;
    private final TenantIdProvider tenantIdProvider;

    public List<ScriptEnvVar> seal(List<ScriptEnvVar> envVars) {
        return ScriptEnvVar.sealAll(envVars, this::encrypt);
    }

    private String encrypt(String plain) {
        String tenantId = tenantIdProvider.getTenantId();
        EncryptionContext context = EncryptionContext.forTenant(tenantId, SCRIPT_ENV_VAR);
        return encryptionService.encrypt(plain, context);
    }
}
