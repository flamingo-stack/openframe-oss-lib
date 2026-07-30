package com.openframe.authz.service.sso;

import com.openframe.authz.config.tenant.TenantContext;
import com.openframe.authz.service.policy.GlobalDomainPolicyLookup;
import com.openframe.authz.service.processor.RegistrationProcessor;
import com.openframe.authz.service.user.UserService;
import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.tenant.SSOPerTenantConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.oidc.OidcUserInfo;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static com.openframe.authz.util.OidcUserUtils.resolveEmail;
import static com.openframe.authz.util.OidcUserUtils.resolveNames;
import static com.openframe.authz.util.OidcUserUtils.resolvePictureUrl;
import static com.openframe.data.document.user.UserRole.ADMIN;
import static java.util.Locale.ROOT;

/**
 * Loads the OIDC user for SSO logins and auto-provisions them into the current tenant when the
 * tenant's SSO config (or the global domain policy) allows it. Extracted from {@code SecurityConfig}
 * so the logic is injectable, testable, and its failures loggable.
 * <p>
 * Provisioning failures never block the login itself — the user may already exist, and rejecting a
 * valid login because a side effect failed would be worse. They are logged at WARN, since the usual
 * symptom (user logs in, then hits 401s because they don't exist in the tenant) is otherwise
 * untraceable.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SsoOidcUserService implements OAuth2UserService<OidcUserRequest, OidcUser> {

    private final SSOConfigService ssoConfigService;
    private final UserService userService;
    private final GlobalDomainPolicyLookup globalDomainPolicyLookup;
    private final RegistrationProcessor registrationProcessor;

    private final OidcUserService delegate = new OidcUserService();

    @Override
    public OidcUser loadUser(OidcUserRequest userRequest) {
        OidcUser user = delegate.loadUser(userRequest);

        autoProvisionIfNeeded(userRequest, user);

        Set<GrantedAuthority> authorities = new HashSet<>(user.getAuthorities());
        OidcUserInfo userInfo = user.getUserInfo() != null
                ? user.getUserInfo()
                : new OidcUserInfo(user.getClaims());

        return new DefaultOidcUser(authorities, userRequest.getIdToken(), userInfo, resolvePreferredPrincipalClaim(user));
    }

    private void autoProvisionIfNeeded(OidcUserRequest userRequest, OidcUser user) {
        String tenantId = TenantContext.getTenantId();
        String provider = userRequest.getClientRegistration().getRegistrationId();
        try {
            if (tenantId == null || provider == null) {
                return;
            }
            String email = resolveEmail(user);
            if (email == null || email.isBlank()) {
                return;
            }

            String normalizedEmail = email.toLowerCase(ROOT);
            String pictureUrl = resolvePictureUrl(user);

            ssoConfigService
                    .getSSOConfig(tenantId, provider)
                    .filter(SSOPerTenantConfig::isEnabled)
                    .ifPresentOrElse(cfg -> {
                        if (!cfg.isAutoProvisionUsers()) {
                            return;
                        }
                        if (isEmailAllowedByDomains(cfg.getAllowedDomains(), email)) {
                            provisionOrRefresh(tenantId, email, normalizedEmail, user, provider, pictureUrl);
                        }
                    }, () -> {
                        String domain = email.substring(email.lastIndexOf('@') + 1).toLowerCase(ROOT);
                        globalDomainPolicyLookup.findTenantIdByDomainIfAutoAllowed(domain)
                                .ifPresent(mappedTenantId -> {
                                    if (tenantId.equals(mappedTenantId)) {
                                        provisionOrRefresh(tenantId, email, normalizedEmail, user, provider, pictureUrl);
                                    }
                                });
                    });
        } catch (Exception e) {
            // Deliberately non-blocking, but never silent: the downstream symptom is a user who can
            // log in yet does not exist in the tenant.
            log.warn("SSO auto-provisioning failed. tenantId={}, provider={}: {}", tenantId, provider, e.getMessage(), e);
        }
    }

    private void provisionOrRefresh(String tenantId,
                                    String email,
                                    String normalizedEmail,
                                    OidcUser user,
                                    String provider,
                                    String pictureUrl) {
        AuthUser authUser = userService.findActiveByEmailAndTenant(normalizedEmail, tenantId)
                .orElseGet(() -> registerUser(tenantId, email, user, provider));
        registrationProcessor.postProcessAutoProvision(authUser, pictureUrl);
    }

    private AuthUser registerUser(String tenantId, String email, OidcUser user, String provider) {
        String[] names = resolveNames(user);
        return userService.registerOrReactivateFromSso(tenantId, email, names[0], names[1], List.of(ADMIN), provider);
    }

    /**
     * Select the preferred claim to use as principal name:
     * email -> preferred_username -> upn -> unique_name -> sub
     */
    private String resolvePreferredPrincipalClaim(OidcUser user) {
        var claims = user.getClaims();
        if (user.getEmail() != null && !user.getEmail().isBlank()) {
            return "email";
        }
        Object preferred = claims.get("preferred_username");
        if (preferred instanceof String s && !s.isBlank()) {
            return "preferred_username";
        }
        Object upn = claims.get("upn");
        if (upn instanceof String s2 && !s2.isBlank()) {
            return "upn";
        }
        Object uniq = claims.get("unique_name");
        if (uniq instanceof String s3 && !s3.isBlank()) {
            return "unique_name";
        }
        return "sub";
    }

    private boolean isEmailAllowedByDomains(List<String> allowedDomains, String email) {
        if (allowedDomains == null || allowedDomains.isEmpty()) {
            return false;
        }
        String domain = email.substring(email.lastIndexOf('@') + 1).toLowerCase(ROOT);
        return allowedDomains.stream()
                .map(d -> d.toLowerCase(ROOT))
                .anyMatch(domain::equals);
    }
}
