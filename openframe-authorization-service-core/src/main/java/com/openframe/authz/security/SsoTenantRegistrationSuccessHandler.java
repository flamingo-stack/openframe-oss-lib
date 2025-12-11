package com.openframe.authz.security;

import com.openframe.authz.security.flow.SsoFlowHandler;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.SavedRequestAwareAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.List;


/**
 * On successful OIDC login, if SSO tenant registration was initiated,
 * finalize tenant and owner user creation using OIDC user info.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SsoTenantRegistrationSuccessHandler extends SavedRequestAwareAuthenticationSuccessHandler {

    private final List<SsoFlowHandler> flowHandlers;
    private final SsoCookieCodec ssoCookieCodec;
    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException, ServletException {

        var handler = flowHandlers.stream()
                .filter(h -> h.isActivated(request))
                .findFirst()
                .orElse(null);

        if (handler == null) {
            super.onAuthenticationSuccess(request, response, authentication);
            return;
        }

        try {
            Cookie cookie = handler.resolveCookie(request);
            validateStateOrThrow(request, cookie);
            handler.handle(request, response, authentication);
        } catch (Exception e) {
            log.error("SSO tenant registration finalization failed: {}", e.getMessage(), e);
            response.sendError(HttpServletResponse.SC_BAD_REQUEST, "tenant_registration_failed");
        }
    }

    private void validateStateOrThrow(HttpServletRequest request, Cookie flowCookie) {
        String returnedState = request.getParameter("state");
        String token = flowCookie.getValue();
        String expectedState = null;
        if (SsoRegistrationConstants.COOKIE_SSO_REG.equals(flowCookie.getName())) {
            expectedState = ssoCookieCodec.decodeTenant(token).map(SsoTenantRegCookiePayload::s).orElse(null);
        } else if (SsoRegistrationConstants.COOKIE_SSO_INVITE.equals(flowCookie.getName())) {
            expectedState = ssoCookieCodec.decodeInvite(token).map(SsoInviteCookiePayload::s).orElse(null);
        }
        if (expectedState == null || !expectedState.equals(returnedState)) {
            throw new IllegalStateException("invalid_state");
        }
    }

}


