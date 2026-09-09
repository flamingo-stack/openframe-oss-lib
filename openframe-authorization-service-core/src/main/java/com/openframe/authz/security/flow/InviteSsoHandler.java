package com.openframe.authz.security.flow;

import com.openframe.core.constants.SsoFlowCookieNames;

import com.openframe.authz.dto.InvitationRegistrationRequest;
import com.openframe.authz.security.SsoCookieCodec;
import com.openframe.authz.security.SsoInviteCookiePayload;
import com.openframe.authz.service.user.InvitationRegistrationService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.UUID;

import static com.openframe.authz.util.OidcUserUtils.resolvePictureUrl;

@Component
@RequiredArgsConstructor
public class InviteSsoHandler implements SsoFlowHandler {

    private final SsoCookieCodec ssoCookieCodec;
    private final InvitationRegistrationService invitationRegistrationService;

    /**
     * Frontend "one last step" consent page. When set, a NEW member joining via SSO is sent here
     * to confirm the account and accept Terms before the user is created; blank keeps the old
     * create-immediately behavior. See {@code SsoJoinController}.
     */
    @org.springframework.beans.factory.annotation.Value("${openframe.sso.join-confirm-url:}")
    private String joinConfirmUrl;

    @Override
    public String cookieName() {
        return SsoFlowCookieNames.OF_SSO_INVITE;
    }

    @Override
    public Optional<String> expectedState(Cookie cookie) {
        return ssoCookieCodec.decodeInvite(cookie.getValue()).map(SsoInviteCookiePayload::s);
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, Authentication authentication) {
        Cookie cookie = requireCookie(request);
        OidcUser user = requireOidcUser(authentication);
        SsoInviteCookiePayload payload = ssoCookieCodec.decodeInvite(cookie.getValue())
                .orElseThrow(() -> new IllegalStateException("SSO session is invalid. Please try again."));

        requireEmail(user); // ensure email present even if not directly used

        // Consent gate: a brand-new member confirms the account + accepts Terms first. The flow
        // cookie is KEPT so SsoJoinController can finalize from the same session. Existing members
        // (re-accepting) and unconfigured environments proceed straight through.
        if (org.springframework.util.StringUtils.hasText(joinConfirmUrl)
                && invitationRegistrationService.isNewMemberJoin(payload.invitationId())) {
            try {
                response.sendRedirect(joinConfirmUrl);
            } catch (java.io.IOException e) {
                throw new IllegalStateException("Failed to start account confirmation.", e);
            }
            return;
        }

        String[] names = resolveNames(request, authentication, user);
        String givenName = names[0];
        String familyName = names[1];

        InvitationRegistrationRequest req = InvitationRegistrationRequest.builder()
                .invitationId(payload.invitationId())
                .firstName(givenName != null ? givenName : "")
                .lastName(familyName != null ? familyName : "")
                .password(UUID.randomUUID().toString())
                .pictureUrl(resolvePictureUrl(user))
                .switchTenant(Boolean.TRUE.equals(payload.switchTenant()))
                .build();

        var userCreated = invitationRegistrationService.registerByInvitation(req);
        String targetTenantId = userCreated.getTenantId();

        // Clear SSO flow cookie but KEEP session to allow OAuth continue
        clearFlowCookieAndRedirect(response, cookie, targetTenantId, payload.redirectTo(), payload.authMobile());
    }

}

