package com.openframe.authz.service.tenant;

import com.openframe.authz.dto.TenantDiscoveryResponse;
import com.openframe.authz.service.policy.GlobalDomainPolicyLookup;
import com.openframe.authz.service.sso.SSOConfigService;
import com.openframe.authz.service.user.UserService;
import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.sso.SSOConfig;
import com.openframe.data.document.tenant.Tenant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static java.util.Locale.ROOT;

/**
 * Resolves which tenant a login email belongs to and which authentication providers that tenant
 * offers. An existing account wins; otherwise the email's domain is matched against per-tenant
 * auto-provisioning SSO configs, then against the global domain policy.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TenantDiscoveryService {

    private static final String OPENFRAME_PROVIDER = SSOConfig.OPENFRAME_PROVIDER;

    private final UserService userService;
    private final TenantService tenantService;
    private final SSOConfigService ssoConfigService;
    private final GlobalDomainPolicyLookup globalDomainPolicyLookup;

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

        return tenantByAutoProvisionSso(domain)
                .or(() -> tenantByGlobalDomainPolicy(domain))
                .map(tenant -> tenantFound(email, tenant))
                .orElseGet(() -> noAccounts(email));
    }

    private Optional<Tenant> tenantByAutoProvisionSso(String domain) {
        return ssoConfigService.findAutoProvisionByDomain(domain)
                .flatMap(cfg -> resolveActiveTenant(cfg.getTenantId()));
    }

    private Optional<Tenant> tenantByGlobalDomainPolicy(String domain) {
        return globalDomainPolicyLookup.findTenantIdByDomainIfAutoAllowed(domain)
                .flatMap(this::resolveActiveTenant);
    }

    private Optional<Tenant> resolveActiveTenant(String tenantId) {
        return tenantService.findById(tenantId).filter(Tenant::isActive);
    }

    private TenantDiscoveryResponse tenantFound(String email, Tenant tenant) {
        return TenantDiscoveryResponse.builder()
                .email(email)
                .hasExistingAccounts(true)
                .tenantId(tenant.getId())
                .domain(tenant.getDomain())
                .authProviders(availableAuthProviders(tenant))
                .build();
    }

    private TenantDiscoveryResponse noAccounts(String email) {
        return TenantDiscoveryResponse.builder()
                .email(email)
                .hasExistingAccounts(false)
                .build();
    }

    private List<String> availableAuthProviders(Tenant tenant) {
        List<String> providers = new ArrayList<>(ssoConfigService.getEffectiveProvidersForTenant(tenant.getId()));
        if (ssoConfigService.isOpenframeLoginEnabled(tenant.getId())) {
            providers.add(OPENFRAME_PROVIDER);
        }
        return providers.stream()
                .filter(StringUtils::hasText)
                .distinct()
                .toList();
    }
}
