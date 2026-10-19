package com.openframe.authz.service.sso;

import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.data.document.sso.SSOConfig;
import com.openframe.data.document.tenant.SSOPerTenantConfig;
import com.openframe.data.repository.tenant.SSOPerTenantConfigRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.*;


@Slf4j
@Service
@RequiredArgsConstructor
public class SSOConfigService {

    private final SSOPerTenantConfigRepository ssoPerTenantConfigRepository;
    private final EncryptionService encryptionService;
    private final List<DefaultProviderConfig> defaultProviderConfigs;

    public Optional<SSOPerTenantConfig> getSSOConfig(String tenantId, String provider) {
        return ssoPerTenantConfigRepository.findFirstByTenantIdAndProviderAndEnabledTrue(tenantId, provider);
    }

    // Falls back to global properties-based SSO config if tenant-specific config is absent.
    public Optional<SSOConfig> getEffectiveSSOConfig(String tenantId, String provider) {
        Optional<SSOPerTenantConfig> perTenant = getSSOConfig(tenantId, provider);
        if (perTenant.isPresent()) {
            return Optional.of(perTenant.get());
        }
        return defaultProviderConfigs.stream()
                .filter(cfg -> cfg.providerId().equalsIgnoreCase(provider))
                .findFirst()
                .flatMap(cfg -> buildFromDefaults(provider, cfg));
    }

    private Optional<SSOConfig> buildFromDefaults(String provider, DefaultProviderConfig defaults) {
        if (!defaults.isConfigured()) {
            return Optional.empty();
        }
        SSOConfig cfg = new SSOConfig();
        cfg.setProvider(provider);
        cfg.setClientId(defaults.getDefaultClientId());
        // Encrypt so downstream decryption works transparently
        cfg.setClientSecret(encryptionService.encryptClientSecret(defaults.getDefaultClientSecret()));
        cfg.setTeamId(defaults.getDefaultTeamId());
        cfg.setKeyId(defaults.getDefaultKeyId());
        cfg.setEnabled(true);
        return Optional.of(cfg);
    }

    public List<SSOPerTenantConfig> getActiveForTenant(String tenantId) {
        return ssoPerTenantConfigRepository.findByTenantIdAndEnabledTrue(tenantId);
    }

    public List<String> getEffectiveProvidersForTenant(String tenantId) {
        Set<String> result = new LinkedHashSet<>();
        getActiveForTenant(tenantId).forEach(cfg -> result.add(cfg.getProvider().toLowerCase(Locale.ROOT)));
        result.addAll(getDefaultProviders());

        // The built-in login's toggle document is not an OIDC provider.
        result.remove(SSOConfig.OPENFRAME_PROVIDER);

        return List.copyOf(result);
    }

    public List<String> getCustomProvidersForTenant(String tenantId) {
        return getActiveForTenant(tenantId).stream()
                .map(cfg -> cfg.getProvider().toLowerCase(Locale.ROOT))
                .filter(provider -> !SSOConfig.OPENFRAME_PROVIDER.equals(provider))
                .distinct()
                .toList();
    }

    // Controlled by a pseudo-provider document (SSOConfig.OPENFRAME_PROVIDER) in sso_configs;
    // absence means enabled — the toggle only ever opts a tenant out.
    public boolean isOpenframeLoginEnabled(String tenantId) {
        return ssoPerTenantConfigRepository
                .findFirstByTenantIdAndProvider(tenantId, SSOConfig.OPENFRAME_PROVIDER)
                .map(SSOConfig::isEnabled)
                .orElse(true);
    }

    public List<String> getDefaultProviders() {
        return defaultProviderConfigs.stream()
                .filter(DefaultProviderConfig::isConfigured)
                .map(cfg -> cfg.providerId().toLowerCase(Locale.ROOT))
                .toList();
    }


    public Optional<SSOPerTenantConfig> findAutoProvisionByDomain(String domain) {
        if (!StringUtils.hasText(domain)) {
            return Optional.empty();
        }
        return ssoPerTenantConfigRepository.findByAllowedDomainsIn(List.of(domain.toLowerCase(Locale.ROOT))).stream()
                .filter(SSOPerTenantConfig::isEnabled)
                .filter(SSOPerTenantConfig::isAutoProvisionUsers)
                .findFirst();
    }

    public String getDecryptedClientSecret(SSOConfig config) {
        if (config.getClientSecret() == null) {
            return null;
        }
        return encryptionService.decryptClientSecret(config.getClientSecret());
    }
}
