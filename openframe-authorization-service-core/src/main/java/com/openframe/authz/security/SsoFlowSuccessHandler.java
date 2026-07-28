package com.openframe.authz.security;

import com.openframe.authz.security.flow.SsoFlowHandler;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.SavedRequestAwareAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;


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

    @Value("${openframe.auth.error-url}")
    private String authErrorUrl;

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
                super.onAuthenticationSuccess(request, response, authentication);
                return;
            }
            // A flow cookie is present but none owns this state: a stale cookie from an abandoned flow,
            // an expired or tampered payload, or a replayed callback.
            log.warn("SSO flow cookie present but no handler matched the returned state. requestUri={}", request.getRequestURI());
            sendError(response, "SSO session expired. Please try again.");
            return;
        }

        try {
            handler.handle(request, response, authentication);
        } catch (Exception e) {
            log.error("SSO tenant registration finalization failed: {}", e.getMessage(), e);
            sendError(response, e.getMessage() != null ? e.getMessage() : "Registration failed. Please try again.");
        }
    }

    private void sendError(HttpServletResponse response, String message) throws IOException {
        response.sendRedirect(authErrorUrl + "?error=" + URLEncoder.encode(message, StandardCharsets.UTF_8));
    }

}
