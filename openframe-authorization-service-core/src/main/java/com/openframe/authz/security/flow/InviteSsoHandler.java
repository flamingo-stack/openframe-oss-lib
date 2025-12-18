package com.openframe.authz.security.flow;

import com.openframe.authz.dto.InvitationRegistrationRequest;
import com.openframe.authz.security.SsoCookieCodec;
import com.openframe.authz.security.SsoInviteCookiePayload;
import com.openframe.authz.security.SsoRegistrationConstants;
import com.openframe.authz.service.user.InvitationRegistrationService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
@RequiredArgsConstructor
public class InviteSsoHandler implements SsoFlowHandler {

    private final SsoCookieCodec ssoCookieCodec;
    private final InvitationRegistrationService invitationRegistrationService;

    @Override
    public String cookieName() {
        return SsoRegistrationConstants.COOKIE_SSO_INVITE;
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, Authentication authentication) {
        Cookie cookie = requireCookie(request);
        OidcUser user = requireOidcUser(authentication);
        SsoInviteCookiePayload payload = ssoCookieCodec.decodeInvite(cookie.getValue())
                .orElseThrow(() -> new IllegalStateException("invalid_cookie"));

        requireEmail(user); // ensure email present even if not directly used
        String[] names = resolveNames(user);
        String givenName = names[0];
        String familyName = names[1];

        InvitationRegistrationRequest req = InvitationRegistrationRequest.builder()
                .invitationId(payload.invitationId())
                .firstName(givenName != null ? givenName : "")
                .lastName(familyName != null ? familyName : "")
                .password(UUID.randomUUID().toString())
                .switchTenant(Boolean.TRUE.equals(payload.switchTenant()))
                .build();

        var userCreated = invitationRegistrationService.registerByInvitation(req);
        String targetTenantId = userCreated.getTenantId();

        // Clear SSO flow cookie but KEEP session to allow OAuth continue
        clearFlowCookieAndRedirect(request, response, cookie, targetTenantId, payload.redirectTo());
    }

}

