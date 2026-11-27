package com.openframe.api.mapper;

import com.openframe.api.dto.SSOConfigRequest;
import com.openframe.api.dto.SSOConfigResponse;
import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.core.exception.EncryptionException;
import com.openframe.data.document.sso.SSOConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import static java.lang.Boolean.TRUE;

@Slf4j
@Component
public class SSOConfigMapper {

    public SSOConfig toEntity(String provider, SSOConfigRequest request, EncryptionService encryptionService) {
        SSOConfig config = new SSOConfig();
        config.setProvider(provider);
        config.setClientId(request.getClientId());
        config.setClientSecret(encryptionService.encryptClientSecret(request.getClientSecret()));
        config.setAutoProvisionUsers(TRUE.equals(request.getAutoProvisionUsers()));
        config.setMsTenantId(request.getMsTenantId());
        config.setAllowedDomains(request.getAllowedDomains());
        config.setEnabled(true);
        return config;
    }

    public void updateEntity(SSOConfig existing, SSOConfigRequest request, EncryptionService encryptionService) {
        existing.setClientId(request.getClientId());
        if (isNewSecret(existing.getClientSecret(), request.getClientSecret(), encryptionService)) {
            existing.setClientSecret(encryptionService.encryptClientSecret(request.getClientSecret()));
        }
        existing.setAutoProvisionUsers(TRUE.equals(request.getAutoProvisionUsers()));
        existing.setMsTenantId(request.getMsTenantId());
        existing.setAllowedDomains(request.getAllowedDomains());
    }

    private static boolean isNewSecret(String storedSecret, String requestedSecret,
                                       EncryptionService encryptionService) {
        if (!StringUtils.hasText(storedSecret)) {
            return true;
        }
        try {
            return !requestedSecret.equals(encryptionService.decryptClientSecret(storedSecret));
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

}


