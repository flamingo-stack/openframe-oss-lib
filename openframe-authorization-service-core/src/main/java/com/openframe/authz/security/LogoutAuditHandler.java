package com.openframe.authz.security;

import com.openframe.authz.config.tenant.TenantContext;
import com.openframe.authz.service.user.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2TokenRevocationAuthenticationToken;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class LogoutAuditHandler implements AuthenticationSuccessHandler {

    private final OAuth2AuthorizationService authorizationService;
    private final UserService userService;
    private final AuthAuditor authAuditor;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) {
        String token = ((OAuth2TokenRevocationAuthenticationToken) authentication).getToken();
        AuthAuditor.safely(() -> recordLogout(token));
        response.setStatus(HttpStatus.OK.value());
    }

    private void recordLogout(String token) {
        OAuth2Authorization authorization = authorizationService.findByToken(token, null);
        if (authorization != null) {
            userService.findActiveByEmailAndTenant(authorization.getPrincipalName(), TenantContext.getTenantId())
                    .ifPresent(user -> authAuditor.recordLogout(user, authorization.getId()));
        }
    }
}
