package com.openframe.authz.security;

import com.openframe.authz.config.tenant.TenantContext;
import com.openframe.authz.service.sso.SsoIdentityService;
import com.openframe.authz.service.sso.SSOConfigService;
import com.openframe.authz.service.user.UserService;
import com.openframe.authz.util.OidcUserUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Component;

import static java.util.Locale.ROOT;
import static org.springframework.util.StringUtils.hasText;

/**
 * Writes the federated identity link after a successful TENANT-SCOPED SSO login — but only when
 * the login carried a POSITIVE trust signal: either the tenant runs its own provider app (the
 * issuer itself vouches for its users), or the provider-asserted email passes the routing trust
 * policy. A success alone is NOT enough: with the Microsoft verified-email gate disabled, a
 * login can succeed on an unverifiable email claim, and a link written from it would later be
 * honored as proof of trust — persisting a pre-gate nOAuth compromise past the gate's rollout.
 * Best-effort — never affects the login it follows.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SsoIdentityCapture {

    private final SsoIdentityService ssoIdentityService;
    private final UserService userService;
    private final SSOConfigService ssoConfigService;
    private final EmailTrustPolicy emailTrustPolicy;

    public void capture(Authentication authentication) {
        try {
            if (!(authentication instanceof OAuth2AuthenticationToken token)
                    || !(token.getPrincipal() instanceof OidcUser user)) {
                return;
            }
            String tenantId = TenantContext.getTenantId();
            String email = OidcUserUtils.resolveEmail(user);
            if (tenantId == null || !hasText(email)) {
                return;
            }
            String provider = token.getAuthorizedClientRegistrationId();
            boolean trusted = ssoConfigService.getSSOConfig(tenantId, provider).isPresent()
                    || emailTrustPolicy.emailTrustedForRouting(provider, user.getClaims());
            if (!trusted) {
                return;
            }
            userService.findActiveByEmailAndTenant(email.toLowerCase(ROOT), tenantId)
                    .ifPresent(authUser -> ssoIdentityService.link(provider, user.getClaims(), authUser));
        } catch (Exception e) {
            log.warn("SSO identity capture failed: {}", e.getMessage());
        }
    }
}
