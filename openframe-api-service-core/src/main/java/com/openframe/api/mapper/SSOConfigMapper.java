package com.openframe.api.mapper;

import com.openframe.api.dto.SSOConfigRequest;
import com.openframe.api.dto.SSOConfigResponse;
import com.openframe.core.service.EncryptionService;
import com.openframe.data.document.sso.SSOConfig;
import org.springframework.stereotype.Component;

import static java.lang.Boolean.TRUE;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Component
public class SSOConfigMapper {

    public SSOConfig toEntity(String provider, SSOConfigRequest request, EncryptionService encryptionService) {
        SSOConfig config = new SSOConfig();
        config.setProvider(provider);
        config.setClientId(request.getClientId());
        config.setClientSecret(encryptionService.encryptClientSecret(request.getClientSecret()));
        config.setAutoProvisionUsers(TRUE.equals(request.getAutoProvisionUsers()));
        config.setMsTenantId(request.getMsTenantId());
        config.setAllowedDomains(normalizeDomains(request.getAllowedDomains()));
        config.setEnabled(true);
        return config;
    }

    public void updateEntity(SSOConfig existing, SSOConfigRequest request, EncryptionService encryptionService) {
        existing.setClientId(request.getClientId());
        existing.setClientSecret(encryptionService.encryptClientSecret(request.getClientSecret()));
        existing.setAutoProvisionUsers(TRUE.equals(request.getAutoProvisionUsers()));
        existing.setMsTenantId(request.getMsTenantId());
        existing.setAllowedDomains(normalizeDomains(request.getAllowedDomains()));
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

    private List<String> normalizeDomains(List<String> domains) {
        if (domains == null) return List.of();
        return domains.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .map(s -> s.toLowerCase(java.util.Locale.ROOT))
                .distinct()
                .collect(Collectors.toList());
    }
}


