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

    /**
     * Whether an ACTIVE SSO configuration exists for the given tenant and provider.
     */
    public boolean hasSSOConfig(String tenantId, String provider) {
        return ssoPerTenantConfigRepository.findFirstByTenantIdAndProviderAndEnabledTrue(tenantId, provider).isPresent();
    }

    /**
     * Get ACTIVE SSO configuration by tenant and provider.
     *
     * @throws NoSuchElementException if no active configuration exists
     */
    public SSOPerTenantConfig ssoConfig(String tenantId, String provider) {
        return ssoPerTenantConfigRepository.findFirstByTenantIdAndProviderAndEnabledTrue(tenantId, provider)
                .orElseThrow(() -> new NoSuchElementException(
                        "No active SSO config for tenant '" + tenantId + "' and provider '" + provider + "'"));
    }

    /**
     * Whether an effective ACTIVE SSO configuration exists for a tenant and provider,
     * falling back to global properties-based SSO config if tenant-specific config is absent.
     */
    public boolean hasEffectiveSSOConfig(String tenantId, String provider) {
        return effectiveSSOConfigOptional(tenantId, provider).isPresent();
    }

    /**
     * Get effective ACTIVE SSO configuration for a tenant and provider.
     * Falls back to global properties-based SSO config if tenant-specific config is absent.
     *
     * @throws NoSuchElementException if no effective configuration exists
     */
    public SSOConfig effectiveSSOConfig(String tenantId, String provider) {
        return effectiveSSOConfigOptional(tenantId, provider)
                .orElseThrow(() -> new NoSuchElementException(
                        "No effective SSO config for tenant '" + tenantId + "' and provider '" + provider + "'"));
    }

    private Optional<SSOConfig> effectiveSSOConfigOptional(String tenantId, String provider) {
        Optional<SSOPerTenantConfig> perTenant = ssoPerTenantConfigRepository.findFirstByTenantIdAndProviderAndEnabledTrue(tenantId, provider);
        return perTenant.map(cfg -> (SSOConfig) cfg)
                .or(() -> defaultProviderConfigs.stream()
                        .filter(cfg -> cfg.providerId().equalsIgnoreCase(provider))
                        .findFirst()
                        .flatMap(cfg -> buildFromDefaults(provider, cfg)));
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
        getActiveForTenant(tenantId).forEach(cfg -> result.add(cfg.getProvider().toLowerCase(Locale.ROOT)));
        result.addAll(getDefaultProviders());

        // The built-in login's toggle document is not an OIDC provider.
        result.remove(SSOConfig.OPENFRAME_PROVIDER);

        return List.copyOf(result);
    }

    /**
     * Whether the built-in OpenFrame (password) login is enabled for the tenant. Controlled by a
     * pseudo-provider document ({@link SSOConfig#OPENFRAME_PROVIDER}) in {@code sso_configs};
     * absence means enabled — the toggle only ever opts a tenant out.
     */
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


    /**
     * Whether an enabled, auto-provisioning SSO config exists for the given email domain (lowercased).
     */
    public boolean hasAutoProvisionByDomain(String domain) {
        return autoProvisionByDomainOptional(domain).isPresent();
    }

    /**
     * Find enabled, auto-provisioning SSO config by email domain (lowercased).
     *
     * @throws NoSuchElementException if no such configuration exists
     */
    public SSOPerTenantConfig autoProvisionByDomain(String domain) {
        return autoProvisionByDomainOptional(domain)
                .orElseThrow(() -> new NoSuchElementException(
                        "No auto-provisioning SSO config for domain '" + domain + "'"));
    }

    private Optional<SSOPerTenantConfig> autoProvisionByDomainOptional(String domain) {
        if (!StringUtils.hasText(domain)) {
            return Optional.empty();
        }
        return ssoPerTenantConfigRepository.findByAllowedDomainsIn(List.of(domain.toLowerCase(Locale.ROOT))).stream()
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
