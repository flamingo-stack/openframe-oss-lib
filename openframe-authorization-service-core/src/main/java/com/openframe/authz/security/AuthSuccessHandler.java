package com.openframe.authz.security;

import com.openframe.authz.config.tenant.TenantContext;
import com.openframe.authz.service.auth.strategy.SsoProviderRegistry;
import com.openframe.authz.service.user.UserService;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.authentication.SavedRequestAwareAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Locale;

import static com.openframe.authz.util.OidcUserUtils.resolveEmail;

/**
 * Authentication success handler that:
 * 1) Updates user's lastLogin timestamp on any successful authentication
 * 2) Delegates to the SSO flow success handler so registration and invitation flows continue
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AuthSuccessHandler extends SavedRequestAwareAuthenticationSuccessHandler {

    private final UserService userService;
    private final SsoFlowSuccessHandler ssoFlowSuccessHandler;
    private final SsoProviderRegistry ssoProviderRegistry;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException, ServletException {
        try {
            String tenantId = TenantContext.getTenantId();
            String email = extractEmail(authentication);
            if (tenantId != null && email != null && !email.isBlank()) {
                userService.touchLastLogin(email, tenantId);
                maybeMarkEmailVerifiedFromSso(authentication, tenantId, email);
            }
        } catch (Exception e) {
            log.warn("Failed to update lastLogin on authentication success: {}", e.getMessage());
        }

        ssoFlowSuccessHandler.onAuthenticationSuccess(request, response, authentication);
    }

    private void maybeMarkEmailVerifiedFromSso(Authentication authentication, String tenantId, String email) {
        if (!(authentication instanceof OAuth2AuthenticationToken oauth2)) {
            return;
        }
        String provider = oauth2.getAuthorizedClientRegistrationId();
        if (provider == null) {
            return;
        }
        if (!ssoProviderRegistry.isSupported(provider)) {
            return;
        }

        // Best practice: only mark verified if the IdP asserts it (when claim is present).
        // Google typically provides email_verified. Microsoft may omit it; we treat omission as verified for trusted providers.
        if (authentication.getPrincipal() instanceof OidcUser oidcUser) {
            Object claim = oidcUser.getClaims().get("email_verified");
            if (claim instanceof Boolean b && !b) {
                return;
            }
            if (claim instanceof String s && "false".equalsIgnoreCase(s)) {
                return;
            }
        }

        userService.findActiveByEmailAndTenant(email.trim().toLowerCase(Locale.ROOT), tenantId)
                .ifPresent(u -> userService.markEmailVerified(u.getId()));
    }

    private String extractEmail(Authentication authentication) {
        Object principal = authentication.getPrincipal();
        if (principal instanceof OidcUser oidcUser) {
            return resolveEmail(oidcUser);
        }
        if (principal instanceof UserDetails userDetails) {
            return userDetails.getUsername();
        }
        return authentication.getName();
    }
}


