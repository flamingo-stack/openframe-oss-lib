package com.openframe.authz.security;

import com.openframe.authz.config.tenant.TenantContext;
import com.openframe.authz.service.auth.strategy.SsoProviderRegistry;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;

import java.io.IOException;

import static com.openframe.authz.config.tenant.TenantContextFilter.TENANT_ID;
import static java.util.Locale.ROOT;

@Slf4j
@RequiredArgsConstructor
public class ProviderAwareAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final SsoProviderRegistry ssoProviderRegistry;

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException authException) throws IOException {
        String provider = request.getParameter("provider");

        // Preserve tenant in session for dynamic ClientRegistration resolution
        String tenantId = TenantContext.getTenantId();
        if (tenantId != null && !tenantId.isBlank()) {
            HttpSession session = request.getSession(true);
            session.setAttribute(TENANT_ID, tenantId);
            log.debug("Stored tenantId in session for SSO redirect: tenantId={}, provider={}", tenantId, provider);
        } else if (ssoProviderRegistry.isSupported(provider)) {
            log.warn("Redirecting to SSO provider without tenantId in context; callback may fail. provider={}, requestUri={}", provider, request.getRequestURI());
        }

        String target = ssoProviderRegistry.isSupported(provider)
                ? "/oauth2/authorization/" + provider.toLowerCase(ROOT)
                : "/login";

        response.sendRedirect(request.getContextPath() + target);
    }
}


