package com.openframe.authz.security.flow;

import com.openframe.authz.dto.TenantRegistrationRequest;
import com.openframe.authz.security.SsoCookieCodec;
import com.openframe.authz.security.SsoRegistrationConstants;
import com.openframe.authz.security.SsoTenantRegCookiePayload;
import com.openframe.authz.service.tenant.TenantRegistrationService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Component;

import java.net.URLEncoder;
import java.util.Locale;
import java.util.UUID;

import static com.openframe.authz.util.OidcUserUtils.resolveEmail;
import static com.openframe.authz.util.OidcUserUtils.stringClaim;
import static java.nio.charset.StandardCharsets.UTF_8;

@Component
@RequiredArgsConstructor
public class TenantRegSsoHandler implements SsoFlowHandler {

    private final SsoCookieCodec ssoCookieCodec;
    private final TenantRegistrationService registrationService;

    @Override
    public String cookieName() {
        return SsoRegistrationConstants.COOKIE_SSO_REG;
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, Authentication authentication) {
        Cookie cookie = resolveCookie(request);
        if (cookie == null) throw new IllegalStateException("sso_cookie_missing");
        OidcUser user = requireOidcUser(authentication);
        SsoTenantRegCookiePayload payload = ssoCookieCodec.decodeTenant(cookie.getValue())
                .orElseThrow(() -> new IllegalStateException("invalid_cookie"));

        String email = requireEmail(user);
        String givenName = stringClaim(user.getClaims().get("given_name"));
        String familyName = stringClaim(user.getClaims().get("family_name"));
        if ((givenName == null || givenName.isBlank()) && (familyName == null || familyName.isBlank())) {
            String full = user.getFullName();
            if (full != null && !full.isBlank()) {
                String[] parts = full.trim().split("\\s+", 2);
                givenName = parts[0];
                familyName = parts.length > 1 ? parts[1] : "";
            }
        }

        if (payload.tenantName() == null || payload.tenantDomain() == null) {
            throw new IllegalStateException("invalid_sso_registration_context");
        }

        TenantRegistrationRequest reg = TenantRegistrationRequest.builder()
                .email(email)
                .firstName(givenName != null ? givenName : "")
                .lastName(familyName != null ? familyName : "")
                .password(UUID.randomUUID().toString())
                .tenantName(payload.tenantName())
                .tenantDomain(payload.tenantDomain().toLowerCase(Locale.ROOT))
                .build();

        var tenant = registrationService.registerTenant(reg);

        clearCookie(response, cookie.getName());
        clearSession(request);

        String target = buildRedirect(payload.redirectTo(), tenant.getId());
        response.setStatus(HttpServletResponse.SC_FOUND);
        response.setHeader("Location", target);
    }

    private static OidcUser requireOidcUser(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof OidcUser u) return u;
        throw new IllegalStateException("OIDC principal expected");
    }

    private static String requireEmail(OidcUser u) {
        String email = resolveEmail(u);
        if (email == null || email.isBlank()) throw new IllegalStateException("email_not_available");
        return email.toLowerCase(Locale.ROOT);
    }

    private static void clearCookie(HttpServletResponse response, String name) {
        Cookie clear = new Cookie(name, "");
        clear.setHttpOnly(true);
        clear.setSecure(true);
        clear.setPath("/");
        clear.setMaxAge(0);
        response.addCookie(clear);
    }

    private static void clearSession(HttpServletRequest request) {
        SecurityContextHolder.clearContext();
        var session = request.getSession(false);
        if (session != null) {
            try {
                session.invalidate();
            } catch (Exception ignored) {
            }
        }
    }

    private static String buildRedirect(String redirectTo, String tenantId) {
        if (redirectTo == null || redirectTo.isBlank()) return "/";
        String sep = redirectTo.contains("?") ? "&" : "?";
        return redirectTo + sep + "tenantId=" + URLEncoder.encode(tenantId, UTF_8);
    }
}

