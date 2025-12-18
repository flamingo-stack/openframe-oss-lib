package com.openframe.authz.security.flow;

import com.openframe.authz.dto.TenantRegistrationRequest;
import com.openframe.authz.security.SsoCookieCodec;
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
import java.util.UUID;


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
    public void handle(HttpServletRequest request, HttpServletResponse response, Authentication authentication) {
        Cookie cookie = requireCookie(request);
        OidcUser user = requireOidcUser(authentication);
        String email = requireEmail(user);

        SsoTenantRegCookiePayload payload = ssoCookieCodec.decodeTenant(cookie.getValue())
                .orElseThrow(() -> new IllegalStateException("invalid_cookie"));

        String[] names = resolveNames(user);
        String givenName = names[0];
        String familyName = names[1];

        if (payload.tenantName() == null || payload.tenantDomain() == null) {
            throw new IllegalStateException("invalid_sso_registration_context");
        }

        TenantRegistrationRequest reg = TenantRegistrationRequest.builder()
                .email(email)
                .accessCode(payload.accessCode())
                .firstName(givenName != null ? givenName : "")
                .lastName(familyName != null ? familyName : "")
                .password(UUID.randomUUID().toString())
                .tenantName(payload.tenantName())
                .tenantDomain(payload.tenantDomain().toLowerCase(Locale.ROOT))
                .build();

        var tenant = registrationService.registerTenant(reg);

        clearFlowCookieAndRedirect(request, response, cookie, tenant.getId(), payload.redirectTo());
    }

}

