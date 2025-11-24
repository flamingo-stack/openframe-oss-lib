package com.openframe.api.service;

import com.openframe.api.config.SSOProperties;
import com.openframe.api.dto.SSOConfigRequest;
import com.openframe.api.dto.SSOConfigResponse;
import com.openframe.api.dto.SSOConfigStatusResponse;
import com.openframe.api.dto.SSOProviderInfo;
import com.openframe.api.mapper.SSOConfigMapper;
import com.openframe.api.service.processor.SSOConfigProcessor;
import com.openframe.core.service.EncryptionService;
import com.openframe.data.document.sso.SSOConfig;
import com.openframe.data.repository.sso.SSOConfigRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.validation.annotation.Validated;

import java.util.List;
import java.util.stream.Collectors;

import static java.lang.Boolean.TRUE;

@Slf4j
@Service
@RequiredArgsConstructor
@Validated
public class SSOConfigService {
    private final SSOConfigRepository ssoConfigRepository;
    private final EncryptionService encryptionService;
    private final SSOProperties ssoProperties;
    private final SSOConfigProcessor ssoConfigProcessor;
    private final SSOConfigMapper ssoConfigMapper;

    private static final String MICROSOFT = "microsoft";

    /**
     * Get list of enabled SSO providers - used by login components
     */
    public List<SSOConfigStatusResponse> getEnabledProviders() {
        log.debug("Getting enabled SSO providers");

        return ssoConfigRepository.findByEnabledTrue().stream()
                .map(config -> SSOConfigStatusResponse.builder()
                        .provider(config.getProvider())
                        .enabled(true)
                        .clientId(config.getClientId())
                        .build())
                .collect(Collectors.toList());
    }

    public List<SSOProviderInfo> getAvailableProviders() {
        return ssoProperties.getProviders();
    }

    /**
     * Get full SSO configuration for admin forms
     * Returns complete configuration data including decrypted client secret for editing
     * Always returns a valid response object, even if configuration doesn't exist
     */
    public SSOConfigResponse getConfig(String provider) {
        return ssoConfigRepository.findByProvider(provider)
                .map(config -> ssoConfigMapper.toResponse(
                        config,
                        encryptionService.decryptClientSecret(config.getClientSecret())
                ))
                .orElse(SSOConfigResponse.builder()
                        .id(null)
                        .provider(provider)
                        .clientId(null)
                        .clientSecret(null)
                        .msTenantId(null)
                        .autoProvisionUsers(false)
                        .enabled(false)
                        .build());
    }

    private SSOConfigResponse saveConfig(String provider, @Valid SSOConfigRequest request) {
        validateAutoProvision(provider, request);
        SSOConfig config = ssoConfigMapper.toEntity(provider, request, encryptionService);

        SSOConfig savedConfig = ssoConfigRepository.save(config);
        log.info("Successfully created SSO configuration for provider '{}'", provider);

        ssoConfigProcessor.postProcessConfigSaved(savedConfig);
        return ssoConfigMapper.toResponse(savedConfig, request.getClientSecret());
    }

    public void deleteConfig(String provider) {
        ssoConfigRepository.findByProvider(provider)
                .ifPresent(config -> {
                    ssoConfigRepository.delete(config);
                    log.info("Successfully deleted SSO configuration for provider '{}'", provider);

                    ssoConfigProcessor.postProcessConfigDeleted(config);
                });
    }

    public SSOConfigResponse upsertConfig(String provider, @Valid SSOConfigRequest request) {
        return ssoConfigRepository.findByProvider(provider)
                .map(existingConfig -> {
                    validateAutoProvision(provider, request);
                    ssoConfigMapper.updateEntity(existingConfig, request, encryptionService);
                    SSOConfig savedConfig = ssoConfigRepository.save(existingConfig);
                    log.info("Successfully updated SSO configuration for provider '{}'", provider);

                    ssoConfigProcessor.postProcessConfigSaved(savedConfig);

                    return ssoConfigMapper.toResponse(savedConfig, request.getClientSecret());
                })
                .orElseGet(() -> {
                    log.info("SSO configuration for provider '{}' not found. Creating new one.", provider);
                    return saveConfig(provider, request);
                });
    }

    public void toggleEnabled(String provider, boolean enabled) {
        ssoConfigRepository.findByProvider(provider)
                .ifPresent(config -> {
                    config.setEnabled(enabled);
                    SSOConfig savedConfig = ssoConfigRepository.save(config);
                    log.info("Successfully {} SSO configuration for provider '{}'",
                            enabled ? "enabled" : "disabled", provider);

                    ssoConfigProcessor.postProcessConfigToggled(savedConfig);
                });
    }

    private void validateAutoProvision(String provider, SSOConfigRequest request) {
        boolean isMicrosoft = MICROSOFT.equals(provider);
        boolean wantsAutoProvision = TRUE.equals(request.getAutoProvisionUsers());
        if (wantsAutoProvision) {
            var domains = request.getAllowedDomains();
            boolean hasAtLeastOne = domains != null && domains.stream().anyMatch(d -> d != null && !d.isBlank());
            if (!hasAtLeastOne) {
                throw new IllegalArgumentException("allowedDomains must contain at least one domain when autoProvisionUsers is true.");
            }
        }
        if (isMicrosoft && wantsAutoProvision) {
            String msTenantId = request.getMsTenantId();
            if (msTenantId == null || msTenantId.isBlank()) {
                throw new IllegalArgumentException("autoProvisionUsers can be true only for Microsoft single-tenant apps (msTenantId is required).");
            }
        }
    }
} 