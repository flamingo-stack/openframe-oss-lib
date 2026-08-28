package com.openframe.authz.security.flow;

import com.openframe.authz.dto.TenantRegistrationRequest;
import com.openframe.authz.security.SsoCookieCodec;
import com.openframe.authz.util.OidcUserUtils;
import com.openframe.authz.security.SsoRegistrationConstants;
import com.openframe.authz.security.SsoTenantRegCookiePayload;
import com.openframe.authz.service.tenant.TenantRegistrationService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

import static com.openframe.authz.util.OidcUserUtils.resolvePictureUrl;
import static org.springframework.util.StringUtils.hasText;


@Component
@RequiredArgsConstructor
public class TenantRegSsoHandler implements SsoFlowHandler {

    private final SsoCookieCodec ssoCookieCodec;
    private final TenantRegistrationService registrationService;

    @Override
    public String cookieName() {
        return SsoRegistrationConstants.COOKIE_SSO_REG;
    }

    @Override
    public Optional<String> expectedState(Cookie cookie) {
        return ssoCookieCodec.decodeTenant(cookie.getValue()).map(SsoTenantRegCookiePayload::s);
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, Authentication authentication) {
        Cookie cookie = requireCookie(request);
        OidcUser user = requireOidcUser(authentication);
        String email = requireEmail(user);

        SsoTenantRegCookiePayload payload = ssoCookieCodec.decodeTenant(cookie.getValue())
                .orElseThrow(() -> new IllegalStateException("SSO session is invalid. Please try again."));

        requireEmailMatchesForm(payload.email(), email);

        String[] names = resolveNames(request, authentication, user);
        String givenName = names[0];
        String familyName = names[1];

        if (payload.tenantName() == null || payload.tenantDomain() == null) {
            throw new IllegalStateException("Missing registration details. Please start the registration again.");
        }

        TenantRegistrationRequest reg = TenantRegistrationRequest.builder()
                .email(email)
                .accessCode(payload.accessCode())
                .firstName(givenName != null ? givenName : "")
                .lastName(familyName != null ? familyName : "")
                .password(UUID.randomUUID().toString())
                .pictureUrl(resolvePictureUrl(user))
                .tenantName(payload.tenantName())
                .tenantDomain(payload.tenantDomain().toLowerCase(Locale.ROOT))
                .emailPreVerified(OidcUserUtils.emailVerifiedClaimAllows(user))
                .attribution(payload.attribution())
                .build();

        var tenant = registrationService.registerTenant(reg);

        clearFlowCookieAndRedirect(response, cookie, tenant.getId(), payload.redirectTo(), payload.authMobile());
    }

    /**
     * The tenant is created with the email the identity provider asserts, but every pre-flight
     * check (disposable-domain, access code, attribution) ran against the email typed into the
     * sign-up form — so a different SSO account must not slip through. Missing form email means a
     * cookie minted before this field existed; the flow cookie lives 10 minutes, so just let it pass.
     */
    private void requireEmailMatchesForm(String formEmail, String ssoEmail) {
        if (!hasText(formEmail)) {
            return;
        }
        if (!formEmail.trim().equalsIgnoreCase(ssoEmail)) {
            throw new IllegalStateException(
                    "This account's email (" + ssoEmail + ") doesn't match the email you entered ("
                            + formEmail.trim() + "). Please sign up with the account that matches the form email.");
        }
    }

}

