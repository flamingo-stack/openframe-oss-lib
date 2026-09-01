package com.openframe.authz.controller;

import com.openframe.authz.dto.RegistrationAttribution;
import com.openframe.authz.dto.SsoLoginInitRequest;
import com.openframe.authz.dto.TenantRegistrationRequest;
import com.openframe.authz.security.SsoCookieCodec;
import com.openframe.authz.security.SsoFlowCookies;
import com.openframe.authz.security.SsoLoginCookiePayload;
import com.openframe.authz.service.sso.SsoAuthorizeData;
import com.openframe.authz.service.sso.SsoLoginService;
import com.openframe.authz.service.tenant.TenantRegistrationService;
import com.openframe.authz.util.OidcUserUtils;
import com.openframe.authz.web.AuthErrorResponder;
import com.openframe.authz.web.Redirects;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.WebUtils;

import java.io.IOException;
import java.util.Locale;
import java.util.UUID;

import static com.openframe.authz.security.SsoRegistrationConstants.COOKIE_SSO_LOGIN;
import static com.openframe.authz.util.OidcUserUtils.resolvePictureUrl;
import static com.openframe.authz.web.AuthStateUtils.clearCookie;
import static com.openframe.authz.web.AuthStateUtils.clearOtherSsoFlowCookies;
import static com.openframe.authz.web.Redirects.foundAtRoot;
import static com.openframe.authz.web.Redirects.seeOther;
import static org.springframework.util.StringUtils.hasText;

/**
 * Email-less SSO login: the user picks a provider on the login page without entering an email.
 * The start endpoint runs the generic-app OAuth dance under the onboarding pseudo-tenant; the
 * callback is owned by {@link com.openframe.authz.security.flow.LoginSsoHandler}. When the
 * provider authenticates someone without an account, the completion endpoint finishes their
 * registration from the still-authenticated SAS session.
 */
@Slf4j
@RestController
@RequestMapping(path = "/oauth", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class SsoLoginController {

    private final SsoLoginService ssoLoginService;
    private final SsoFlowCookies ssoFlowCookies;
    private final SsoCookieCodec ssoCookieCodec;
    private final TenantRegistrationService registrationService;
    private final AuthErrorResponder authErrorResponder;

    @GetMapping(path = "/login/sso")
    public void startSsoLogin(@Valid @ModelAttribute SsoLoginInitRequest request,
                              HttpServletRequest httpRequest,
                              HttpServletResponse httpResponse) throws IOException {
        try {
            // Unlike registration/invite starts, the session is NOT cleared here: an anonymous
            // visitor has none worth keeping, and the OAuth dance creates a fresh one anyway.
            clearOtherSsoFlowCookies(httpResponse, COOKIE_SSO_LOGIN);

            SsoAuthorizeData data = ssoLoginService.startLogin(request);
            ssoFlowCookies.write(httpResponse, COOKIE_SSO_LOGIN, data.cookieValue(), data.cookieTtlSeconds());

            seeOther(httpResponse, data.redirectPath());
        } catch (Exception e) {
            authErrorResponder.send(httpResponse, httpRequest, "sso-login-init", e,
                    "Sign-in failed. Please try again.");
        }
    }

    /**
     * What the signup-continue page renders: the identity the provider asserted, read from the
     * authenticated SAS session. 401-style errors surface as the standard error redirect would be
     * wrong for an XHR, so this endpoint answers JSON — an expired session is a 409 with a message
     * the page shows before sending the user back to login.
     */
    @GetMapping(path = "/login/sso/pending")
    public PendingSsoIdentity pendingSsoIdentity(Authentication authentication, HttpServletRequest httpRequest) {
        try {
            OidcUser user = requireSessionOidcUser(authentication);
            SsoLoginCookiePayload payload = requireLoginFlowCookie(httpRequest);
            String[] names = OidcUserUtils.resolveNames(user);
            return new PendingSsoIdentity(
                    OidcUserUtils.resolveEmail(user),
                    names[0],
                    names[1],
                    payload.provider());
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
        }
    }

    public record PendingSsoIdentity(String email, String firstName, String lastName, String provider) {}

    /**
     * Finishes registration for an SSO identity that had no account at login time. Identity (email,
     * names, picture, verified flag) comes exclusively from the authenticated SAS session's
     * {@link OidcUser} — the client only supplies what SSO cannot: organization name and domain.
     * Requires the {@code of_sso_login} flow cookie, both as proof this belongs to the email-less
     * flow and to carry {@code redirectTo}/{@code authMobile} into {@code /oauth/continue}.
     */
    @GetMapping(path = "/login/sso/complete")
    public void completeSsoRegistration(@RequestParam("tenantName") String tenantName,
                                        @RequestParam("tenantDomain") String tenantDomain,
                                        @ModelAttribute RegistrationAttribution attribution,
                                        Authentication authentication,
                                        HttpServletRequest httpRequest,
                                        HttpServletResponse httpResponse) throws IOException {
        try {
            OidcUser user = requireSessionOidcUser(authentication);
            SsoLoginCookiePayload payload = requireLoginFlowCookie(httpRequest);

            String email = OidcUserUtils.resolveEmail(user);
            if (!hasText(email)) {
                throw new IllegalStateException("Email not provided by SSO provider.");
            }
            String[] names = OidcUserUtils.resolveNames(user);

            TenantRegistrationRequest reg = TenantRegistrationRequest.builder()
                    .email(email.toLowerCase(Locale.ROOT))
                    .firstName(names[0] != null ? names[0] : "")
                    .lastName(names[1] != null ? names[1] : "")
                    .password(UUID.randomUUID().toString())
                    .pictureUrl(resolvePictureUrl(user))
                    .tenantName(tenantName)
                    .tenantDomain(tenantDomain.toLowerCase(Locale.ROOT))
                    .emailPreVerified(OidcUserUtils.emailVerifiedClaimAllows(user))
                    .attribution(attribution)
                    .build();

            var tenant = registrationService.registerTenant(reg);

            clearCookie(httpResponse, COOKIE_SSO_LOGIN);
            foundAtRoot(httpResponse, Redirects.oauthContinuePath(tenant.getId(), payload.redirectTo(), payload.authMobile()));
        } catch (Exception e) {
            authErrorResponder.send(httpResponse, httpRequest, "sso-login-complete", e,
                    "Registration failed. Please try again.");
        }
    }

    private OidcUser requireSessionOidcUser(Authentication authentication) {
        if (authentication instanceof OAuth2AuthenticationToken token
                && token.getPrincipal() instanceof OidcUser user) {
            return user;
        }
        throw new IllegalStateException("Your sign-in session expired. Please sign in again.");
    }

    private SsoLoginCookiePayload requireLoginFlowCookie(HttpServletRequest request) {
        Cookie cookie = WebUtils.getCookie(request, COOKIE_SSO_LOGIN);
        if (cookie == null) {
            throw new IllegalStateException("SSO session expired. Please sign in again.");
        }
        return ssoCookieCodec.decodeLogin(cookie.getValue())
                .orElseThrow(() -> new IllegalStateException("SSO session is invalid. Please sign in again."));
    }
}
