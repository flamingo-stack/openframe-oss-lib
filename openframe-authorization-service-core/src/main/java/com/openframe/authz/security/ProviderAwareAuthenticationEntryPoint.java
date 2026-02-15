package com.openframe.authz.security;

import com.openframe.authz.config.tenant.TenantContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;

import java.io.IOException;

import static com.openframe.authz.config.oidc.GoogleSSOProperties.GOOGLE;
import static com.openframe.authz.config.oidc.MicrosoftSSOProperties.MICROSOFT;
import static com.openframe.authz.config.tenant.TenantContextFilter.TENANT_ID;
import static java.util.Locale.ROOT;

@Slf4j
public class ProviderAwareAuthenticationEntryPoint implements AuthenticationEntryPoint {

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException authException) throws IOException {
        String provider = request.getParameter("provider");

        // Preserve tenant in session for dynamic ClientRegistration resolution
        String tenantId = TenantContext.getTenantId();
        if (tenantId != null && !tenantId.isBlank()) {
            HttpSession session = request.getSession(true);
            session.setAttribute(TENANT_ID, tenantId);
            log.debug("Stored tenantId in session for SSO redirect: tenantId={}, provider={}", tenantId, provider);
        } else if (provider != null && (GOOGLE.equals(provider.toLowerCase(ROOT)) || MICROSOFT.equals(provider.toLowerCase(ROOT)))) {
            log.warn("Redirecting to SSO provider without tenantId in context; callback may fail. provider={}, requestUri={}", provider, request.getRequestURI());
        }

        String target = "/login";
        if (provider != null) {
            String p = provider.toLowerCase(ROOT);
            switch (p) {
                case GOOGLE, MICROSOFT ->
                        target = "/oauth2/authorization/" + p;
                default -> target = "/login";
            }
        }

        response.sendRedirect(request.getContextPath() + target);
    }
}


