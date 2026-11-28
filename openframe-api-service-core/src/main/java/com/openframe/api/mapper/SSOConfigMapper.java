package com.openframe.api.mapper;

import com.openframe.api.dto.SSOConfigRequest;
import com.openframe.api.dto.SSOConfigResponse;
import com.openframe.core.crypto.service.EncryptionContext;
import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.core.exception.EncryptionException;
import com.openframe.data.document.sso.SSOConfig;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import static com.openframe.core.crypto.service.SecretPurpose.SSO_CLIENT_SECRET;
import static java.lang.Boolean.TRUE;

@Slf4j
@Component
@RequiredArgsConstructor
public class SSOConfigMapper {

    private final TenantIdProvider tenantIdProvider;

    public SSOConfig toEntity(String provider, SSOConfigRequest request, EncryptionService encryptionService) {
        SSOConfig config = new SSOConfig();
        config.setProvider(provider);
        config.setClientId(request.getClientId());
        String encryptedClientSecret = encryptClientSecret(request, encryptionService);
        config.setClientSecret(encryptedClientSecret);
        config.setAutoProvisionUsers(TRUE.equals(request.getAutoProvisionUsers()));
        config.setMsTenantId(request.getMsTenantId());
        config.setAllowedDomains(request.getAllowedDomains());
        config.setEnabled(true);
        return config;
    }

    public void updateEntity(SSOConfig existing, SSOConfigRequest request, EncryptionService encryptionService) {
        existing.setClientId(request.getClientId());
        if (isNewSecret(existing.getClientSecret(), request.getClientSecret(), encryptionService)) {
            existing.setClientSecret(encryptClientSecret(request, encryptionService));
        }
        existing.setAutoProvisionUsers(TRUE.equals(request.getAutoProvisionUsers()));
        existing.setMsTenantId(request.getMsTenantId());
        existing.setAllowedDomains(request.getAllowedDomains());
    }

    private boolean isNewSecret(String storedSecret, String requestedSecret, EncryptionService encryptionService) {
        if (!StringUtils.hasText(storedSecret)) {
            return true;
        }
        try {
            return !requestedSecret.equals(encryptionService.decrypt(storedSecret, context()));
        } catch (EncryptionException e) {
            log.warn("Stored SSO client secret cannot be read, replacing it: {}", e.getMessage());
            return true;
        }
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

    private String encryptClientSecret(SSOConfigRequest request, EncryptionService encryptionService) {
        return encryptionService.encrypt(request.getClientSecret(), context());
    }

    private EncryptionContext context() {
        return EncryptionContext.forTenant(tenantIdProvider.getTenantId(), SSO_CLIENT_SECRET);
    }
}


