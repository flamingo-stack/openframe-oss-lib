package com.openframe.api.mapper;

import com.openframe.api.dto.SSOConfigRequest;
import com.openframe.api.dto.SSOConfigResponse;
import com.openframe.core.crypto.service.EncryptionContext;
import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.data.document.sso.SSOConfig;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import static com.openframe.core.crypto.service.SecretPurpose.SSO_CLIENT_SECRET;
import static java.lang.Boolean.TRUE;

@Component
@RequiredArgsConstructor
public class SSOConfigMapper {

    private final TenantIdProvider tenantIdProvider;

    public SSOConfig toEntity(String provider, SSOConfigRequest request, EncryptionService encryptionService) {
        SSOConfig config = new SSOConfig();
        config.setProvider(provider);
        config.setClientId(request.getClientId());
        config.setClientSecret(encryptionService.encrypt(request.getClientSecret(), context()));
        config.setAutoProvisionUsers(TRUE.equals(request.getAutoProvisionUsers()));
        config.setMsTenantId(request.getMsTenantId());
        config.setAllowedDomains(request.getAllowedDomains());
        config.setEnabled(true);
        return config;
    }

    public void updateEntity(SSOConfig existing, SSOConfigRequest request, EncryptionService encryptionService) {
        existing.setClientId(request.getClientId());
        existing.setClientSecret(encryptionService.encrypt(request.getClientSecret(), context()));
        existing.setAutoProvisionUsers(TRUE.equals(request.getAutoProvisionUsers()));
        existing.setMsTenantId(request.getMsTenantId());
        existing.setAllowedDomains(request.getAllowedDomains());
    }

    public SSOConfigResponse toResponse(SSOConfig entity, String decryptedSecret) {
        return SSOConfigResponse.builder()
                .id(entity.getId())
                .provider(entity.getProvider())
                .clientId(entity.getClientId())
                .clientSecret(decryptedSecret)
                .autoProvisionUsers(entity.isAutoProvisionUsers())
                .msTenantId(entity.getMsTenantId())
                .enabled(entity.isEnabled())
                .allowedDomains(entity.getAllowedDomains())
                .build();
    }

    private EncryptionContext context() {
        return EncryptionContext.forTenant(tenantIdProvider.getTenantId(), SSO_CLIENT_SECRET);
    }
}


