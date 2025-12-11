package com.openframe.authz.config.tenant;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

import static org.springframework.core.Ordered.HIGHEST_PRECEDENCE;

@Slf4j
@Component
@Order(HIGHEST_PRECEDENCE + 10)
public class TenantContextFilter extends OncePerRequestFilter {

    public static final String TENANT_ID = "TENANT_ID";

    private static final Set<String> EXCLUDED_CONTEXTS = Set.of("login", "sso", "sas", "public", ".well-known");

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        try {
            String tenantId = null;
            String appPath = getString(request);

            if (appPath.length() > 1) {
                String[] parts = appPath.split("/", 3); // ["", maybeTenant, rest]
                if (parts.length >= 3) {
                    String maybeTenant = parts[1];
                    String rest = "/" + parts[2];
                    if (!maybeTenant.isBlank() && !EXCLUDED_CONTEXTS.contains(maybeTenant)
                            && (rest.startsWith("/oauth2/")
                            || rest.startsWith("/.well-known/")
                            || rest.startsWith("/connect/")
                            || rest.equals("/login")
                            || rest.equals("/userinfo"))) {
                        tenantId = maybeTenant;
                    }
                }
            }
            if (tenantId == null || tenantId.equals(".well-known")) {
                String qp = request.getParameter("tenant");
                if (qp != null && !qp.isBlank()) tenantId = qp;
            }
            if (tenantId == null || tenantId.equals(".well-known")) {
                Object sess = request.getSession(false) != null ? request.getSession(false).getAttribute(TENANT_ID) : null;
                if (sess instanceof String s && !s.isBlank()) {
                    tenantId = s;
                }
            }

            if (tenantId != null && !tenantId.equals(".well-known")) {
                var session = request.getSession(false);
                if (session != null) {
                    Object oldTenantId = session.getAttribute(TENANT_ID);
                    if (oldTenantId != null && !tenantId.equals(oldTenantId)) {
                        log.debug("Tenant changed from {} to {} - invalidating old session", oldTenantId, tenantId);
                        session.invalidate();
                        session = null;
                    }
                }
                
                if (session == null) {
                    session = request.getSession(true);
                }
                
                TenantContext.setTenantId(tenantId);
                session.setAttribute(TENANT_ID, tenantId);
            }
            filterChain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }

    private static String getString(HttpServletRequest request) {
        String requestUri = request.getRequestURI();
        String contextPath = request.getContextPath();
        String appPath;
        if (requestUri == null) {
            appPath = "/";
        } else if (contextPath != null && !contextPath.isEmpty() && requestUri.startsWith(contextPath)) {
            appPath = requestUri.substring(contextPath.length());
            if (appPath.isEmpty()) appPath = "/";
        } else {
            appPath = requestUri;
        }
        return appPath;
    }
}


