package com.openframe.authz.service.validation;

import com.openframe.authz.service.sso.SSOConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import static com.openframe.authz.security.SsoRegistrationConstants.ONBOARDING_TENANT_ID;
import static java.util.Locale.ROOT;

@Service
@RequiredArgsConstructor
public class SsoProviderValidator {

    private final SSOConfigService ssoConfigService;

    public String normalizeProvider(String provider) {
        return provider.trim().toLowerCase(ROOT);
    }

    public void ensureProviderConfiguredForTenant(String tenantId, String provider) {
        var effective = ssoConfigService.getEffectiveProvidersForTenant(tenantId);
        boolean configured = effective.stream().anyMatch(p -> p.equals(provider));
        if (!configured) {
            throw new IllegalArgumentException("SSO provider not configured");
        }
    }

    public void ensureProviderConfiguredForOnboarding(String provider) {
        ensureProviderConfiguredForTenant(ONBOARDING_TENANT_ID, provider);
    }
}

