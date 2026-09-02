package com.openframe.authz.security.flow;

import com.openframe.authz.security.SsoCookieCodec;
import com.openframe.authz.security.SsoLoginCookiePayload;
import com.openframe.authz.security.SsoRegistrationConstants;
import com.openframe.authz.service.sso.SSOConfigService;
import com.openframe.authz.service.tenant.TenantService;
import com.openframe.authz.service.user.UserService;
import com.openframe.authz.util.OidcUserUtils;
import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.tenant.Tenant;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Optional;

import static org.springframework.util.StringUtils.hasText;

/**
 * Callback owner for the email-less SSO login: the user authenticated at a generic (default)
 * provider app without telling us who they are first. The provider-asserted email decides the
 * tenant; a tenant that runs its own provider app is out of bounds for the generic one; an
 * unknown email continues into registration instead of dead-ending.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LoginSsoHandler implements SsoFlowHandler {

    private static final String MICROSOFT = "microsoft";

    private final SsoCookieCodec ssoCookieCodec;
    private final UserService userService;
    private final TenantService tenantService;
    private final SSOConfigService ssoConfigService;

    /**
     * Frontend page that continues an unknown SSO identity into registration (org name + domain).
     * Blank means the continuation is not enabled and an unknown email is an error instead.
     */
    @Value("${openframe.sso.login.signup-continue-url:}")
    private String signupContinueUrl;

    @Override
    public String cookieName() {
        return SsoRegistrationConstants.COOKIE_SSO_LOGIN;
    }

    @Override
    public Optional<String> expectedState(Cookie cookie) {
        return ssoCookieCodec.decodeLogin(cookie.getValue()).map(SsoLoginCookiePayload::s);
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, Authentication authentication) throws IOException {
        Cookie cookie = requireCookie(request);
        OidcUser user = requireOidcUser(authentication);
        String email = requireEmail(user);

        SsoLoginCookiePayload payload = ssoCookieCodec.decodeLogin(cookie.getValue())
                .orElseThrow(() -> new IllegalStateException("SSO session is invalid. Please try again."));

        String provider = registrationId(authentication, payload);
        requireEmailTrustedForRouting(provider, user);

        AuthUser authUser = userService.findActiveByEmail(email).orElse(null);
        if (authUser == null) {
            continueIntoRegistration(response, email);
            return;
        }

        String tenantId = authUser.getTenantId();
        ensureGenericProviderAllowed(tenantId, provider);

        tenantService.findById(tenantId)
                .filter(Tenant::isActive)
                .orElseThrow(() -> new IllegalStateException("Your account is not active. Please contact your administrator."));

        clearFlowCookieAndRedirect(response, cookie, tenantId, payload.redirectTo(), payload.authMobile());
    }

    private String registrationId(Authentication authentication, SsoLoginCookiePayload payload) {
        return authentication instanceof OAuth2AuthenticationToken token
                ? token.getAuthorizedClientRegistrationId()
                : payload.provider();
    }

    /**
     * Routing an existing account by a provider-asserted email is only safe when the provider
     * vouches for mailbox/domain ownership. Google and Apple always do (email_verified). A generic
     * multi-tenant Microsoft app does not: the email attribute is free text set by the issuing
     * directory's admin, and anyone can create a directory (the "nOAuth" account-takeover class) —
     * so Microsoft additionally requires a positive domain-ownership signal, {@code xms_edov}
     * (an optional claim that must be enabled on the generic app registration).
     */
    private void requireEmailTrustedForRouting(String provider, OidcUser user) {
        boolean trusted;
        if (MICROSOFT.equals(provider)) {
            trusted = truthy(user.getClaims().get("xms_edov"))
                    || Boolean.TRUE.equals(user.getClaims().get("email_verified"));
        } else {
            trusted = OidcUserUtils.emailVerifiedClaimAllows(user);
        }
        if (!trusted) {
            log.warn("event=sso-login-unverified-email provider={} sub={}", provider, user.getSubject());
            throw new IllegalStateException(
                    "This account's email is not verified by the provider. Enter your email on the login page instead.");
        }
    }

    private static boolean truthy(Object claim) {
        return Boolean.TRUE.equals(claim) || "true".equalsIgnoreCase(OidcUserUtils.stringClaim(claim));
    }

    /**
     * A tenant with its own enabled provider app has pinned sign-in to it (their conditional
     * access, their policies) — the generic app must not become a side door. The email-discovery
     * path keeps routing these tenants to their custom app.
     */
    private void ensureGenericProviderAllowed(String tenantId, String provider) {
        if (ssoConfigService.getSSOConfig(tenantId, provider).isPresent()) {
            log.warn("event=sso-login-forbidden-provider tenant={} provider={}", tenantId, provider);
            throw new IllegalStateException(
                    "Your organization uses its own sign-in for this provider. Enter your email on the login page to be redirected to it.");
        }
    }

    /**
     * Unknown email, verified identity: too valuable to throw away. The SAS session already holds
     * the authenticated OidcUser, so the frontend continuation page only needs to collect what SSO
     * cannot provide (organization name and domain) and call the completion endpoint, which reads
     * the identity from the session. The flow cookie is deliberately KEPT — the completion endpoint
     * uses it for redirectTo/authMobile and as proof the request belongs to this flow.
     */
    private void continueIntoRegistration(HttpServletResponse response, String email) throws IOException {
        if (!hasText(signupContinueUrl)) {
            throw new IllegalStateException(
                    "No account found for " + email + ". Please sign up first.");
        }
        log.info("event=sso-login-continue-registration email={}", email);
        response.sendRedirect(signupContinueUrl);
    }
}
