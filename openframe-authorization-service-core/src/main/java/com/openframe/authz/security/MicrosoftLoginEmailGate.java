package com.openframe.authz.security;

import com.openframe.authz.config.oidc.MicrosoftSSOProperties;
import com.openframe.authz.config.tenant.TenantContext;
import com.openframe.authz.service.sso.SSOConfigService;
import com.openframe.authz.service.sso.SsoIdentityService;
import com.openframe.authz.service.user.UserService;
import com.openframe.authz.util.OidcUserUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Component;

import static com.openframe.authz.config.oidc.MicrosoftSSOProperties.MICROSOFT;

/**
 * Verified-email gate for the TENANT-SCOPED web login — the same nOAuth defense the email-less
 * flow enforces, applied to plain logins through the generic Microsoft app: an attacker-created
 * directory can put any email into a {@code /common} token, and this login resolves the account
 * by that email. Tenants running their own single-tenant app are exempt — their directory is
 * legitimately authoritative for their users.
 * <p>
 * Off by default: enabling it before {@code xms_edov} is configured on the generic app
 * registration fails every generic Microsoft login. Sequence: portal claim first, verify tokens
 * carry it, then flip {@code openframe.sso.microsoft.require-verified-email} per environment.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MicrosoftLoginEmailGate {

    private final MicrosoftSSOProperties microsoftProps;
    private final SSOConfigService ssoConfigService;
    private final EmailTrustPolicy emailTrustPolicy;
    private final SsoIdentityService ssoIdentityService;
    private final UserService userService;

    private boolean isLinkedToClaimedEmail(String tenantId, OidcUser user) {
        String email = OidcUserUtils.resolveEmail(user);
        if (email == null || tenantId == null) {
            return false;
        }
        return ssoIdentityService.findLink(MICROSOFT, user.getClaims())
                .flatMap(link -> userService.findActiveById(link.getUserId()))
                .filter(u -> tenantId.equals(u.getTenantId()))
                .filter(u -> email.equalsIgnoreCase(u.getEmail()))
                .isPresent();
    }

    /** @throws IllegalStateException when the login must not proceed */
    public void require(Authentication authentication) {
        if (!microsoftProps.isRequireVerifiedEmail()
                || !(authentication instanceof OAuth2AuthenticationToken token)
                || !MICROSOFT.equals(token.getAuthorizedClientRegistrationId())
                || !(token.getPrincipal() instanceof OidcUser user)) {
            return;
        }
        String tenantId = TenantContext.getTenantId();
        // A per-tenant custom app means a tenant-scoped issuer — its admin is authoritative.
        if (tenantId != null && ssoConfigService.getSSOConfig(tenantId, MICROSOFT).isPresent()) {
            return;
        }
        // A previously bound identity link is proof enough: the subject cannot be forged, and it
        // must point at the user this login's email resolves to in this tenant.
        if (isLinkedToClaimedEmail(tenantId, user)) {
            return;
        }
        if (!emailTrustPolicy.emailTrustedForRouting(MICROSOFT, user.getClaims())) {
            log.warn("event=sso-login-unverified-email provider=microsoft tenant={} sub={} {}",
                    tenantId, user.getSubject(), OidcUserUtils.describeEmailTrustSignals(user.getClaims()));
            throw new IllegalStateException(
                    "This account's email is not verified by the provider. Please contact your administrator.");
        }
    }
}
