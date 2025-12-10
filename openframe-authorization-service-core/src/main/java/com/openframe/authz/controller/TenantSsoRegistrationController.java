package com.openframe.authz.controller;

import com.openframe.authz.dto.SsoTenantRegistrationInitRequest;
import com.openframe.authz.service.tenant.TenantService;
import com.openframe.security.jwt.JwtService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.time.Instant;
import java.util.UUID;

import static com.openframe.authz.config.oidc.GoogleSSOProperties.GOOGLE;
import static com.openframe.authz.config.oidc.MicrosoftSSOProperties.MICROSOFT;
import static java.util.Locale.ROOT;

/**
 * Starts SSO-based tenant registration flow.
 * Validates input, stores pre-registration data in a signed JWT cookie, and redirects to chosen provider.
 */
@RestController
@RequestMapping(path = "/oauth", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class TenantSsoRegistrationController {

    public static final String COOKIE_SSO_REG = "of_sso_reg";
    private static final String ONBOARDING_TENANT_ID = "sso-onboarding";

    private final TenantService tenantService;
    private final JwtService jwtService;

    @PostMapping(path = "/register/sso", consumes = MediaType.APPLICATION_JSON_VALUE)
    public void startSsoRegistration(@Valid @RequestBody SsoTenantRegistrationInitRequest request,
                                    HttpServletRequest httpRequest,
                                    HttpServletResponse httpResponse) throws IOException {
        String provider = normalizeProvider(request.getProvider());
        if (!GOOGLE.equals(provider) && !MICROSOFT.equals(provider)) {
            httpResponse.sendError(HttpServletResponse.SC_BAD_REQUEST, "Unsupported provider");
            return;
        }

        // Basic pre-validation: domain availability
        String domain = request.getTenantDomain().toLowerCase(ROOT);
        if (tenantService.existByDomain(domain)) {
            httpResponse.sendError(HttpServletResponse.SC_CONFLICT, "Tenant domain already exists");
            return;
        }

        // Generate our own state and sign JWT cookie with context
        String state = UUID.randomUUID().toString();
        String token = buildSignedCookie(state, request.getTenantName(), domain, provider);

        Cookie cookie = new Cookie(COOKIE_SSO_REG, token);
        cookie.setHttpOnly(true);
        cookie.setSecure(true);
        cookie.setPath("/");
        cookie.setMaxAge(600);
        httpResponse.addCookie(cookie);

        // Redirect to Spring Security's oauth2 authorization endpoint under onboarding tenant context
        // The resolver will read state from cookie and inject it into the outgoing authorization request.
        String target = "/" + ONBOARDING_TENANT_ID + "/oauth2/authorization/" + provider;
        httpResponse.sendRedirect(httpRequest.getContextPath() + target);
    }

    private static String normalizeProvider(String p) {
        return p == null ? null : p.trim().toLowerCase(ROOT);
    }

    private String buildSignedCookie(String state, String tenantName, String tenantDomain, String provider) {
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .subject("sso_tenant_registration")
                .claim("s", state)
                .claim("tenantName", tenantName)
                .claim("tenantDomain", tenantDomain)
                .claim("provider", provider)
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(600))
                .build();
        return jwtService.generateToken(claims);
    }
}

