package com.openframe.authz.security;

import com.openframe.authz.config.tenant.TenantContext;
import com.openframe.authz.service.user.UserService;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.authentication.SavedRequestAwareAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

import static com.openframe.authz.util.OidcUserUtils.resolveEmail;

/**
 * Authentication success handler that:
 * 1) Updates user's lastLogin timestamp on any successful authentication
 * 2) Delegates to the existing SSO registration success handler to preserve SSO flows
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AuthSuccessHandler extends SavedRequestAwareAuthenticationSuccessHandler {

    private final UserService userService;
    private final SsoTenantRegistrationSuccessHandler ssoTenantRegistrationSuccessHandler;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException, ServletException {
        try {
            String tenantId = TenantContext.getTenantId();
            String email = extractEmail(authentication);
            if (tenantId != null && email != null && !email.isBlank()) {
                userService.touchLastLogin(email, tenantId);
            }
        } catch (Exception e) {
            // Do not block login flow if updating lastLogin fails
            log.warn("Failed to update lastLogin on authentication success: {}", e.getMessage());
        }

        // Delegate to SSO success handler so SSO-specific flows continue to work.
        ssoTenantRegistrationSuccessHandler.onAuthenticationSuccess(request, response, authentication);
    }

    private String extractEmail(Authentication authentication) {
        Object principal = authentication.getPrincipal();
        if (principal instanceof OidcUser oidcUser) {
            return resolveEmail(oidcUser);
        }
        if (principal instanceof UserDetails userDetails) {
            return userDetails.getUsername();
        }
        // Fallback to authentication name
        return authentication.getName();
    }
}


