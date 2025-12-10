package com.openframe.authz.security;

import com.openframe.authz.controller.TenantSsoRegistrationController;
import com.openframe.authz.dto.TenantRegistrationRequest;
import com.openframe.authz.service.tenant.TenantRegistrationService;
import com.openframe.security.jwt.JwtService;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.authentication.SavedRequestAwareAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Map;
import java.util.Locale;
import java.util.UUID;

/**
 * On successful OIDC login, if SSO tenant registration was initiated,
 * finalize tenant and owner user creation using OIDC user info.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SsoTenantRegistrationSuccessHandler extends SavedRequestAwareAuthenticationSuccessHandler {

    private final TenantRegistrationService registrationService;
    private final JwtService jwtService;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws ServletException, IOException {
        try {
            finalizeSsoTenantRegistrationIfNeeded(request, response, authentication);
        } catch (Exception e) {
            log.error("SSO tenant registration finalization failed: {}", e.getMessage(), e);
            // Surface error to client
            response.sendError(HttpServletResponse.SC_BAD_REQUEST, "tenant_registration_failed");
            return;
        }
        super.onAuthenticationSuccess(request, response, authentication);
    }

    private void finalizeSsoTenantRegistrationIfNeeded(HttpServletRequest request,
                                                       HttpServletResponse response,
                                                       Authentication authentication) {
        Cookie regCookie = findCookie(request, TenantSsoRegistrationController.COOKIE_SSO_REG);
        if (regCookie == null) return;

        if (!(authentication.getPrincipal() instanceof OidcUser oidcUser)) {
            throw new IllegalStateException("OIDC principal expected");
        }

        Map<String, Object> payload = decodePayload(regCookie.getValue());
        String tenantName = stringClaim(payload.get("tenantName"));
        String tenantDomain = stringClaim(payload.get("tenantDomain"));
        String expectedState = stringClaim(payload.get("s"));
        String returnedState = request.getParameter("state");
        if (expectedState == null || !expectedState.equals(returnedState)) {
            throw new IllegalStateException("invalid_state");
        }
        if (tenantName == null || tenantDomain == null) {
            throw new IllegalStateException("invalid_sso_registration_context");
        }

        String email = resolveEmail(oidcUser);
        if (email == null || email.isBlank()) {
            throw new IllegalStateException("email_not_available");
        }

        String givenName = stringClaim(oidcUser.getClaims().get("given_name"));
        String familyName = stringClaim(oidcUser.getClaims().get("family_name"));
        if ((givenName == null || givenName.isBlank()) && (familyName == null || familyName.isBlank())) {
            String name = oidcUser.getFullName();
            if (name != null && !name.isBlank()) {
                String[] parts = name.trim().split("\\s+", 2);
                givenName = parts[0];
                familyName = parts.length > 1 ? parts[1] : "";
            }
        }

        TenantRegistrationRequest req = TenantRegistrationRequest.builder()
                .email(email.toLowerCase(Locale.ROOT))
                .firstName(givenName != null ? givenName : "")
                .lastName(familyName != null ? familyName : "")
                .password(UUID.randomUUID().toString())
                .tenantName(tenantName)
                .tenantDomain(tenantDomain.toLowerCase(Locale.ROOT))
                .build();

        registrationService.registerTenant(req);

        // Remove cookie
        Cookie clear = new Cookie(TenantSsoRegistrationController.COOKIE_SSO_REG, "");
        clear.setHttpOnly(true);
        clear.setSecure(true);
        clear.setPath("/");
        clear.setMaxAge(0);
        response.addCookie(clear);
    }

    private Map<String, Object> decodePayload(String value) {
        try {
            return jwtService.decodeToken(value).getClaims();
        } catch (Exception e) {
            throw new IllegalStateException("failed_to_decode_cookie", e);
        }
    }

    private static Cookie findCookie(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (Cookie c : cookies) {
            if (name.equals(c.getName())) return c;
        }
        return null;
    }

    private static String resolveEmail(OidcUser user) {
        String email = user.getEmail();
        if (email != null && !email.isBlank()) return email;
        Object preferred = user.getClaims().get("preferred_username");
        if (preferred instanceof String s && !s.isBlank()) return s;
        Object upn = user.getClaims().get("upn");
        if (upn instanceof String s2 && !s2.isBlank()) return s2;
        Object uniq = user.getClaims().get("unique_name");
        if (uniq instanceof String s3 && !s3.isBlank()) return s3;
        return null;
    }

    private static String stringClaim(Object v) {
        return v instanceof String s && !s.isBlank() ? s : null;
    }
}

