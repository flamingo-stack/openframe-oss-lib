package com.openframe.authz.security.flow;

import com.openframe.core.constants.SsoFlowCookieNames;

import com.openframe.authz.security.EmailTrustPolicy;
import com.openframe.authz.security.SsoCookieCodec;
import com.openframe.authz.security.SsoLoginCookiePayload;
import com.openframe.authz.service.sso.SSOConfigService;
import com.openframe.authz.service.sso.SignupTicketService;
import com.openframe.authz.service.sso.SsoIdentityService;
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

import static com.openframe.authz.web.Redirects.foundAtRoot;
import static java.net.URLEncoder.encode;
import static java.nio.charset.StandardCharsets.UTF_8;
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

    private final SsoCookieCodec ssoCookieCodec;
    private final SignupTicketService signupTicketService;
    private final SsoIdentityService ssoIdentityService;
    private final EmailTrustPolicy emailTrustPolicy;
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
        return SsoFlowCookieNames.OF_SSO_LOGIN;
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

        // Link-first: a previously bound subject outranks the email claim entirely — it cannot be
        // forged by a hostile directory and needs no verified-email signal. Email-based routing
        // (gated) is the first-association bootstrap only.
        AuthUser authUser = ssoIdentityService.findLink(provider, user.getClaims())
                .flatMap(link -> userService.findActiveById(link.getUserId()))
                .orElse(null);

        if (authUser == null) {
            requireEmailTrustedForRouting(provider, user);
            authUser = userService.findActiveByEmail(email).orElse(null);
            if (authUser == null) {
                continueIntoRegistration(request, response, authentication, payload, provider, user, email);
                return;
            }
            ssoIdentityService.link(provider, user.getClaims(), authUser);
        } else {
            ssoIdentityService.link(provider, user.getClaims(), authUser);
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
        if (!emailTrustPolicy.emailTrustedForRouting(provider, user.getClaims())) {
            log.warn("event=sso-login-unverified-email provider={} sub={} {}",
                    provider, user.getSubject(), OidcUserUtils.describeEmailTrustSignals(user.getClaims()));
            throw new IllegalStateException(
                    "This account's email is not verified by the provider. Enter your email on the login page instead.");
        }
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
    private void continueIntoRegistration(HttpServletRequest request,
                                          HttpServletResponse response,
                                          Authentication authentication,
                                          SsoLoginCookiePayload payload,
                                          String provider,
                                          OidcUser user,
                                          String email) throws IOException {
        if (payload.authMobile() && hasText(payload.redirectTo())) {
            // The auth sheet's cookies never reach the app's process (the same boundary the
            // devTicket exists for), so the pending identity is parked server-side and only an
            // opaque ticket travels. The redirect target is validated by the BFF hop against its
            // existing allow-list — this handler makes no redirect-policy decision.
            String[] names = resolveNames(request, authentication, user);
            String ticket = signupTicketService.create(email, names[0], names[1], provider,
                    OidcUserUtils.emailVerifiedClaimAllows(user));
            log.info("event=sso-login-continue-registration-mobile provider={}", provider);
            foundAtRoot(response, "/oauth/signup-continue?signupTicket=" + urlEncode(ticket)
                    + "&redirectTo=" + urlEncode(payload.redirectTo()));
            return;
        }
        if (!hasText(signupContinueUrl)) {
            throw new IllegalStateException(
                    "No account found for " + email + ". Please sign up first.");
        }
        log.info("event=sso-login-continue-registration email={}", email);
        response.sendRedirect(signupContinueUrl);
    }

    private static String urlEncode(String value) {
        return encode(value, UTF_8);
    }
}
