package com.openframe.authz.service.tenant;

import com.openframe.authz.dto.TenantDiscoveryResponse;
import com.openframe.authz.service.policy.GlobalDomainPolicyLookup;
import com.openframe.authz.service.sso.CompanySsoLoginService;
import com.openframe.authz.service.sso.SSOConfigService;
import com.openframe.authz.service.user.UserService;
import com.openframe.core.config.AuthHardeningProperties;
import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.sso.SSOConfig;
import com.openframe.data.document.tenant.SSOPerTenantConfig;
import com.openframe.data.document.tenant.Tenant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static java.util.Locale.ROOT;

/** Resolves sign-in choices under the deployment's workspace discovery policy. */
@Slf4j
@Service
@RequiredArgsConstructor
public class TenantDiscoveryService {

    private static final String OPENFRAME_PROVIDER = SSOConfig.OPENFRAME_PROVIDER;

    private final UserService userService;
    private final TenantService tenantService;
    private final SSOConfigService ssoConfigService;
    private final CompanySsoLoginService companySsoLoginService;
    private final GlobalDomainPolicyLookup globalDomainPolicyLookup;
    private final AuthHardeningProperties hardening;

    public TenantDiscoveryResponse discoverTenantForEmail(String email) {
        log.debug("Discovering tenants for email: {}", email);

        return userService.findActiveByEmail(email)
                .map(user -> respondForExistingUser(email, user))
                .orElseGet(() -> respondByEmailDomain(email));
    }

    /**
     * An existing account is authoritative: when its tenant is gone or inactive the discovery ends
     * with "no accounts" rather than falling through to domain-based matching.
     */
    private TenantDiscoveryResponse respondForExistingUser(String email, AuthUser user) {
        return tenantService.findById(user.getTenantId())
                .filter(Tenant::isActive)
                .map(tenant -> tenantFound(email, tenant))
                .orElseGet(() -> noAccounts(email));
    }

    private TenantDiscoveryResponse respondByEmailDomain(String email) {
        String domain = email.substring(email.lastIndexOf('@') + 1).toLowerCase(ROOT);
        if (!hardening.enabled()) {
            return findLegacyTenant(domain).map(tenant -> tenantFound(email, tenant)).orElseGet(() -> noAccounts(email));
        }

        return ssoConfigService.findAutoProvisionByDomain(domain)
                .filter(config -> !OPENFRAME_PROVIDER.equalsIgnoreCase(config.getProvider()))
                .filter(config -> findActiveTenant(config.getTenantId()).isPresent())
                .map(config -> companySsoForUnknownAccount(email, config))
                .orElseGet(() -> noAccounts(email));
    }

    private Optional<Tenant> findLegacyTenant(String domain) {
        return ssoConfigService.findAutoProvisionByDomain(domain)
                .flatMap(config -> findActiveTenant(config.getTenantId()))
                .or(() -> globalDomainPolicyLookup.findTenantIdByDomainIfAutoAllowed(domain)
                        .flatMap(this::findActiveTenant));
    }

    private Optional<Tenant> findActiveTenant(String tenantId) {
        return tenantService.findById(tenantId).filter(Tenant::isActive);
    }

    private TenantDiscoveryResponse companySsoForUnknownAccount(String email, SSOPerTenantConfig config) {
        List<String> providers = List.of(config.getProvider().toLowerCase(ROOT));
        return TenantDiscoveryResponse.builder()
                .email(email)
                .hasExistingAccounts(false)
                .customProviders(providers)
                .ssoLoginHandle(companySsoLoginService.issue(config.getTenantId(), providers))
                .build();
    }

    private TenantDiscoveryResponse tenantFound(String email, Tenant tenant) {
        boolean openframeLoginEnabled = ssoConfigService.isOpenframeLoginEnabled(tenant.getId());
        List<String> customProviders = ssoConfigService.getCustomProvidersForTenant(tenant.getId());
        String handle = hardening.enabled() && !customProviders.isEmpty()
                ? companySsoLoginService.issue(tenant.getId(), customProviders) : null;
        return TenantDiscoveryResponse.builder()
                .email(email)
                .hasExistingAccounts(true)
                .tenantId(tenant.getId())
                .tenantName(hardening.enabled() ? null : tenant.getName())
                .domain(tenant.getDomain())
                .authProviders(availableAuthProviders(tenant, openframeLoginEnabled))
                .openframeLoginEnabled(openframeLoginEnabled)
                .customProviders(customProviders)
                .ssoLoginHandle(handle)
                .build();
    }

    private TenantDiscoveryResponse noAccounts(String email) {
        return TenantDiscoveryResponse.builder()
                .email(email)
                .hasExistingAccounts(false)
                .build();
    }

    private List<String> availableAuthProviders(Tenant tenant, boolean openframeLoginEnabled) {
        List<String> providers = new ArrayList<>(ssoConfigService.getEffectiveProvidersForTenant(tenant.getId()));
        if (openframeLoginEnabled) {
            providers.add(OPENFRAME_PROVIDER);
        }
        return providers.stream()
                .filter(StringUtils::hasText)
                .distinct()
                .toList();
    }
}
