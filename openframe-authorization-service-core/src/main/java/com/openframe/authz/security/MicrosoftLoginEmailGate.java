package com.openframe.authz.security;

import com.openframe.authz.config.tenant.TenantContext;
import com.openframe.authz.service.sso.SSOConfigService;
import com.openframe.authz.util.OidcUserUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Component;

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

    private static final String MICROSOFT = "microsoft";

    private final SSOConfigService ssoConfigService;

    @Value("${openframe.sso.microsoft.require-verified-email:false}")
    private boolean requireVerifiedEmail;

    /** @throws IllegalStateException when the login must not proceed */
    public void require(Authentication authentication) {
        if (!requireVerifiedEmail
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
        if (!OidcUserUtils.emailTrustedForRouting(MICROSOFT, user.getClaims())) {
            log.warn("event=sso-login-unverified-email provider=microsoft tenant={} sub={}",
                    tenantId, user.getSubject());
            throw new IllegalStateException(
                    "This account's email is not verified by the provider. Please contact your administrator.");
        }
    }
}
