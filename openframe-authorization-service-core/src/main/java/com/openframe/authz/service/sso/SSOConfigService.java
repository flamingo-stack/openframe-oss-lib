package com.openframe.authz.service.sso;

import com.openframe.core.service.EncryptionService;
import com.openframe.data.document.sso.SSOConfig;
import com.openframe.data.document.tenant.SSOPerTenantConfig;
import com.openframe.data.repository.tenant.SSOPerTenantConfigRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

import static com.openframe.authz.config.oidc.GoogleSSOProperties.GOOGLE;

@Slf4j
@Service
@RequiredArgsConstructor
public class SSOConfigService {

    private final SSOPerTenantConfigRepository ssoPerTenantConfigRepository;
    private final EncryptionService encryptionService;

    @Value("${openframe.tenancy.local-tenant:false}")
    private boolean localTenant;

    /**
     * Get ACTIVE SSO configuration by tenant and provider.
     */
    public Optional<SSOPerTenantConfig> getSSOConfig(String tenantId, String provider) {
        return ssoPerTenantConfigRepository.findFirstByTenantIdAndProviderAndEnabledTrue(localTenant? null : tenantId, provider);
    }

    /**
     * Get ACTIVE SSO configurations for a tenant (independent of provider).
     * Active = enabled + non-empty clientId/clientSecret.
     */
    public List<SSOPerTenantConfig> getActiveForTenant(String tenantId) {
        return ssoPerTenantConfigRepository.findByTenantIdAndEnabledTrue(tenantId);
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