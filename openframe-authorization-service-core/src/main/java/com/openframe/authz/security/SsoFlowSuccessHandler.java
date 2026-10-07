package com.openframe.authz.security;

import com.openframe.authz.security.flow.SsoFlowHandler;
import com.openframe.authz.service.sso.SsoOidcUserService;
import com.openframe.authz.service.sso.apple.AppleWebTokenCapture;
import com.openframe.authz.web.AuthErrorResponder;
import com.openframe.authz.web.AuthStateUtils;
import com.openframe.core.exception.AuthFlowException;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.SavedRequestAwareAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.List;

import static com.openframe.core.exception.AuthErrorCode.EMAIL_NOT_VERIFIED;
import static com.openframe.core.exception.AuthErrorCode.REGISTRATION_FAILED;
import static com.openframe.core.exception.AuthErrorCode.SSO_SESSION_EXPIRED;


/**
 * On successful OIDC login, dispatches to the {@link SsoFlowHandler} that owns the callback —
 * tenant registration or invitation acceptance — identified by the state the provider echoed back.
 * Falls through to normal login when no SSO flow is in progress.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SsoFlowSuccessHandler extends SavedRequestAwareAuthenticationSuccessHandler {

    private final List<SsoFlowHandler> flowHandlers;
    private final AuthErrorResponder authErrorResponder;
    private final AppleWebTokenCapture appleWebTokenCapture;
    private final MicrosoftLoginEmailGate microsoftLoginEmailGate;
    private final SsoIdentityCapture ssoIdentityCapture;
    private final SsoOidcUserService ssoOidcUserService;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException, ServletException {

        String returnedState = request.getParameter("state");

        var handler = flowHandlers.stream()
                .filter(h -> h.matchesState(request, returnedState))
                .findFirst()
                .orElse(null);

        if (handler == null) {
            if (flowHandlers.stream().noneMatch(h -> h.isActivated(request))) {
                try {
                    microsoftLoginEmailGate.require(authentication);
                } catch (IllegalStateException e) {
                    authErrorResponder.send(response, request, "sso-login-unverified-email", e, EMAIL_NOT_VERIFIED);
                    return;
                }
                // Only a plain login may auto-provision: an invitation or registration callback
                // creates its own user, and provisioning the IdP email alongside it would mint a
                // second account that skips that flow's rules (switch-tenant, consent gate).
                try {
                    ssoOidcUserService.autoProvisionForTenantLogin(authentication);
                } catch (Exception e) {
                    authErrorResponder.send(response, request, "sso-login-auto-provision", e,
                            "SSO login failed. Please try again.");
                    return;
                }
                super.onAuthenticationSuccess(request, response, authentication);
                appleWebTokenCapture.captureIfApple(request, authentication);
                ssoIdentityCapture.capture(authentication);
                return;
            }
            // A flow cookie is present but none owns this state: a stale cookie from an abandoned flow,
            // an expired or tampered payload, or a replayed callback. Drop the leftovers so they
            // cannot also steal the next attempt.
            AuthStateUtils.clearSsoFlowCookies(response);
            authErrorResponder.send(response, request, "sso-flow-state-mismatch",
                    new AuthFlowException(SSO_SESSION_EXPIRED, "SSO session expired. Please try again."),
                    SSO_SESSION_EXPIRED);
            return;
        }

        try {
            handler.handle(request, response, authentication);
            // After the handler: flows that create the user have created it by now, so the
            // capture's lookup by the authenticated email finds the owner. The response is
            // already committed (redirect) — the capture only writes to the database.
            appleWebTokenCapture.captureIfApple(request, authentication);
        } catch (Exception e) {
            AuthStateUtils.clearSsoFlowCookies(response);
            authErrorResponder.send(response, request, "sso-flow-finalize", e, REGISTRATION_FAILED);
        }
    }

}
