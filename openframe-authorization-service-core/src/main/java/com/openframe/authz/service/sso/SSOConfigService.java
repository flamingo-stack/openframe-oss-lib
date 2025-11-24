package com.openframe.authz.service.sso;

import com.openframe.core.service.EncryptionService;
import com.openframe.data.document.sso.SSOConfig;
import com.openframe.data.document.tenant.SSOPerTenantConfig;
import com.openframe.data.repository.tenant.SSOPerTenantConfigRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.Locale;
import static org.apache.commons.lang3.StringUtils.isNotBlank;

@Slf4j
@Service
@RequiredArgsConstructor
public class SSOConfigService {

    private final SSOPerTenantConfigRepository ssoPerTenantConfigRepository;
    private final EncryptionService encryptionService;
    private final List<DefaultProviderConfig> defaultProviderConfigs;

    @Value("${openframe.tenancy.local-tenant:false}")
    private boolean localTenant;

    /**
     * Get ACTIVE SSO configuration by tenant and provider.
     */
    public Optional<SSOPerTenantConfig> getSSOConfig(String tenantId, String provider) {
        return ssoPerTenantConfigRepository.findFirstByTenantIdAndProviderAndEnabledTrue(localTenant? null : tenantId, provider);
    }

    /**
     * Get effective ACTIVE SSO configuration for a tenant and provider.
     * Falls back to global properties-based SSO config if tenant-specific config is absent.
     */
    public Optional<SSOConfig> getEffectiveSSOConfig(String tenantId, String provider) {
        Optional<SSOPerTenantConfig> perTenant = getSSOConfig(tenantId, provider);
        if (perTenant.isPresent()) {
            return perTenant.map(cfg -> cfg);
        }
        return defaultProviderConfigs.stream()
                .filter(cfg -> cfg.providerId().equalsIgnoreCase(provider))
                .findFirst()
                .flatMap(cfg -> buildFromDefaults(provider, cfg.getDefaultClientId(), cfg.getDefaultClientSecret()));
    }

    private Optional<SSOConfig> buildFromDefaults(String provider, String clientId, String clientSecret) {
        if (clientId == null || clientId.isBlank() || clientSecret == null || clientSecret.isBlank()) {
            return Optional.empty();
        }
        SSOConfig cfg = new SSOConfig();
        cfg.setProvider(provider);
        cfg.setClientId(clientId);
        // Encrypt so downstream decryption works transparently
        cfg.setClientSecret(encryptionService.encryptClientSecret(clientSecret));
        cfg.setEnabled(true);
        return Optional.of(cfg);
    }

    /**
     * Get ACTIVE SSO configurations for a tenant (independent of provider).
     * Active = enabled + non-empty clientId/clientSecret.
     */
    public List<SSOPerTenantConfig> getActiveForTenant(String tenantId) {
        return ssoPerTenantConfigRepository.findByTenantIdAndEnabledTrue(tenantId);
    }

    /**
     * Get effective providers for tenant: union of active per-tenant providers and available defaults from properties.
     */
    public List<String> getEffectiveProvidersForTenant(String tenantId) {
        Set<String> result = new LinkedHashSet<>();

        for (SSOPerTenantConfig cfg : getActiveForTenant(tenantId)) {
                result.add(cfg.getProvider().toLowerCase());
        }

        for (DefaultProviderConfig cfg : defaultProviderConfigs) {
            if (isNotBlank(cfg.getDefaultClientId()) && isNotBlank(cfg.getDefaultClientSecret())) {
                    result.add(cfg.providerId().toLowerCase());
            }
        }

        return new ArrayList<>(result);
    }

    /**
     * Find enabled, auto-provisioning SSO config by email domain (lowercased).
     */
    public Optional<SSOPerTenantConfig> findAutoProvisionByDomain(String domain) {
        if (domain == null || domain.isBlank()) {
            return Optional.empty();
        }
        String d = domain.toLowerCase(Locale.ROOT);
        List<SSOPerTenantConfig> matches = ssoPerTenantConfigRepository.findByAllowedDomainsIn(List.of(d));
        return matches.stream()
                .filter(SSOPerTenantConfig::isEnabled)
                .filter(SSOPerTenantConfig::isAutoProvisionUsers)
                .findFirst();
    }

    /**
     * Get decrypted client secret for SSO configuration
     */
    public String getDecryptedClientSecret(SSOConfig config) {
        if (config.getClientSecret() == null) {
            return null;
        }
        return encryptionService.decryptClientSecret(config.getClientSecret());
    }
}