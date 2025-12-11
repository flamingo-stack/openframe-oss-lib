package com.openframe.authz.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.authz.dto.TenantRegistrationRequest;
import com.openframe.authz.service.tenant.TenantRegistrationService;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.authentication.SavedRequestAwareAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Locale;
import java.util.UUID;

import static com.openframe.authz.util.OidcUserUtils.resolveEmail;
import static com.openframe.authz.util.OidcUserUtils.stringClaim;

/**
 * On successful OIDC login, if SSO tenant registration was initiated,
 * finalize tenant and owner user creation using OIDC user info.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SsoTenantRegistrationSuccessHandler extends SavedRequestAwareAuthenticationSuccessHandler {

    private final TenantRegistrationService registrationService;
    private final SsoCookieCodec ssoCookieCodec;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws ServletException, IOException {
        // If this is NOT our SSO registration flow, continue default behavior
        Cookie cookie = getRegCookie(request);
        if (cookie == null) {
            super.onAuthenticationSuccess(request, response, authentication);
            return;
        }
        try {
            finalizeSsoTenantRegistrationAndRespond(request, response, authentication, cookie);
        } catch (Exception e) {
            log.error("SSO tenant registration finalization failed: {}", e.getMessage(), e);
            response.sendError(HttpServletResponse.SC_BAD_REQUEST, "tenant_registration_failed");
        }
    }

    private void finalizeSsoTenantRegistrationAndRespond(HttpServletRequest request,
                                                         HttpServletResponse response,
                                                         Authentication authentication,
                                                         Cookie regCookie) throws IOException {

        OidcUser oidcUser = requireOidcUser(authentication);
        validateStateOrThrow(request);

        SsoCookiePayload payload = ssoCookieCodec.decode(regCookie.getValue())
                .orElseThrow(() -> new IllegalStateException("invalid_cookie"));
        String tenantName = payload.tenantName();
        String tenantDomain = payload.tenantDomain();
        if (tenantName == null || tenantDomain == null) {
            throw new IllegalStateException("invalid_sso_registration_context");
        }

        String email = requireEmail(oidcUser);
        String[] names = resolveNames(oidcUser);

        TenantRegistrationRequest req = buildTenantRegistrationRequest(tenantName, tenantDomain, email, names[0], names[1]);
        var tenant = registrationService.registerTenant(req);

        clearRegistrationCookie(response);
        clearAuthenticationSession(request);
        // Final redirect if provided
        String target = buildFinalRedirect(payload.redirectTo(), tenant.getId());
        if (target == null) {
            target = "/";
        }
        response.setStatus(HttpServletResponse.SC_FOUND);
        response.setHeader("Location", target);
    }

    private OidcUser requireOidcUser(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof OidcUser u) {
            return u;
        }
        throw new IllegalStateException("OIDC principal expected");
    }

    private void validateStateOrThrow(HttpServletRequest request) {
        String returnedState = request.getParameter("state");
        String expectedState = null;
        try {
            Cookie[] cookies = request.getCookies();
            if (cookies != null) {
                for (Cookie c : cookies) {
                    if (SsoRegistrationConstants.COOKIE_SSO_REG.equals(c.getName())) {
                        expectedState = ssoCookieCodec.decode(c.getValue()).map(SsoCookiePayload::s).orElse(null);
                        break;
                    }
                }
            }
        } catch (Exception ignored) {
        }
        if (expectedState == null || !expectedState.equals(returnedState)) {
            throw new IllegalStateException("invalid_state");
        }
    }

    private String requireEmail(OidcUser oidcUser) {
        String email = resolveEmail(oidcUser);
        if (email == null || email.isBlank()) {
            throw new IllegalStateException("email_not_available");
        }
        return email.toLowerCase(Locale.ROOT);
    }

    private String[] resolveNames(OidcUser oidcUser) {
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
        return new String[]{givenName != null ? givenName : "", familyName != null ? familyName : ""};
    }

    private TenantRegistrationRequest buildTenantRegistrationRequest(String tenantName,
                                                                     String tenantDomain,
                                                                     String email,
                                                                     String givenName,
                                                                     String familyName) {
        return TenantRegistrationRequest.builder()
                .email(email)
                .firstName(givenName)
                .lastName(familyName)
                .password(UUID.randomUUID().toString())
                .tenantName(tenantName)
                .tenantDomain(tenantDomain.toLowerCase(Locale.ROOT))
                .build();
    }

    private void clearRegistrationCookie(HttpServletResponse response) {
        Cookie clear = new Cookie(SsoRegistrationConstants.COOKIE_SSO_REG, "");
        clear.setHttpOnly(true);
        clear.setSecure(true);
        clear.setPath("/");
        clear.setMaxAge(0);
        response.addCookie(clear);
    }

    private void clearAuthenticationSession(HttpServletRequest request) {
        SecurityContextHolder.clearContext();
        var session = request.getSession(false);
        if (session != null) {
            try {
                session.invalidate();
            } catch (Exception ignored) {
            }
        }
    }

    private String buildFinalRedirect(String redirectTo, String tenantId) {
        if (redirectTo == null || redirectTo.isBlank()) return null;
        String sep = redirectTo.contains("?") ? "&" : "?";
        return redirectTo + sep + "tenantId=" + java.net.URLEncoder.encode(tenantId, java.nio.charset.StandardCharsets.UTF_8);
    }

    private Cookie getRegCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (Cookie c : cookies) {
            if (SsoRegistrationConstants.COOKIE_SSO_REG.equals(c.getName())) return c;
        }
        return null;
    }
}


