package com.openframe.authz.security;

import com.openframe.authz.config.tenant.TenantContext;
import com.openframe.authz.service.sso.SsoIdentityService;
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
 * Writes the federated identity link after a successful TENANT-SCOPED SSO login: at this point
 * the login has passed whatever trust the path enforces (custom-app issuer, or the Microsoft
 * verified-email gate when enabled), so binding the provider subject to the resolved user is the
 * trusted first association that lets every later login resolve by subject instead of email.
 * Best-effort — never affects the login it follows.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SsoIdentityCapture {

    private final SsoIdentityService ssoIdentityService;
    private final UserService userService;

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
            userService.findActiveByEmailAndTenant(email.toLowerCase(ROOT), tenantId)
                    .ifPresent(authUser -> ssoIdentityService.link(
                            token.getAuthorizedClientRegistrationId(), user.getClaims(), authUser));
        } catch (Exception e) {
            log.warn("SSO identity capture failed: {}", e.getMessage());
        }
    }
}
