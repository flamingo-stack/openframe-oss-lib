package com.openframe.authz.service.tenant;

import com.openframe.authz.dto.TenantDiscoveryResponse;
import com.openframe.authz.service.policy.GlobalDomainPolicyLookup;
import com.openframe.authz.service.sso.SSOConfigService;
import com.openframe.authz.service.user.UserService;
import com.openframe.data.document.tenant.Tenant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import static java.util.Locale.ROOT;

/**
 * Service for tenant discovery based on user email
 * Helps users find which tenants they have access to
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TenantDiscoveryService {

    private static final String DEFAULT_PROVIDER = "openframe-sso";
    private final UserService userService;
    private final TenantService tenantService;
    private final SSOConfigService ssoConfigService;
    private final GlobalDomainPolicyLookup globalDomainPolicyLookup;

    @Value("${openframe.tenancy.local-tenant:false}")
    private boolean localTenant;

    @Value("${openframe.tenancy.base-domain:openframe.ai}")
    private String baseDomain;

    /**
     * Discover tenants for a given email
     * Returns available authentication providers for each tenant
     */
    public TenantDiscoveryResponse discoverTenantForEmail(String email) {
        log.debug("Discovering tenants for email: {}", email);

        return userService.findActiveByEmail(email)
                .map(user -> tenantService.findById(user.getTenantId())
                        .filter(Tenant::isActive)
                        .map(tenant -> TenantDiscoveryResponse.builder()
                                .email(email)
                                .hasExistingAccounts(true)
                                .tenantId(tenant.getId())
                                .authProviders(getAvailableAuthProviders(tenant))
                                .build())
                        .orElseGet(() -> TenantDiscoveryResponse.builder()
                                .email(email)
                                .hasExistingAccounts(false)
                                .build())
                )
                .orElseGet(() -> {
                    // Fallback: no existing user. Try domain-based discovery via allowedDomains + autoProvision flag.
                    int at = email.lastIndexOf('@');
                    String domain = email.substring(at + 1).toLowerCase(ROOT);
                    return ssoConfigService.findAutoProvisionByDomain(domain)
                            .flatMap(cfg -> localTenant ? tenantService.findFirst() : tenantService.findById(cfg.getTenantId()).filter(Tenant::isActive))
                            .map(tenant -> TenantDiscoveryResponse.builder()
                                    .email(email)
                                    .hasExistingAccounts(true)
                                    .tenantId(tenant.getId())
                                    .authProviders(getAvailableAuthProviders(tenant))
                                    .build())
                            .orElseGet(() -> {
                                // Fallback 2: check global domain policy (shared) for autoAllow + domain match
                                return globalDomainPolicyLookup.findTenantIdByDomainIfAutoAllowed(domain)
                                        .flatMap(tid -> localTenant ? tenantService.findFirst() : tenantService.findById(tid).filter(Tenant::isActive))
                                        .map(tenant -> TenantDiscoveryResponse.builder()
                                                .email(email)
                                                .hasExistingAccounts(true)
                                                .tenantId(tenant.getId())
                                                .authProviders(getAvailableAuthProviders(tenant))
                                                .build())
                                        .orElseGet(() -> TenantDiscoveryResponse.builder()
                                                .email(email)
                                                .hasExistingAccounts(false)
                                                .build());
                            });
                });
    }

    /**
     * Get available authentication providers for a tenant/user combination
     */
    private List<String> getAvailableAuthProviders(Tenant tenant) {

        List<String> ssoProviders = ssoConfigService.getEffectiveProvidersForTenant(localTenant ? null : tenant.getId());

        List<String> providers = new ArrayList<>(ssoProviders);
        providers.add(DEFAULT_PROVIDER);

        return providers.stream()
                .filter(p -> p != null && !p.isBlank())
                .distinct()
                .collect(Collectors.toList());
    }
}