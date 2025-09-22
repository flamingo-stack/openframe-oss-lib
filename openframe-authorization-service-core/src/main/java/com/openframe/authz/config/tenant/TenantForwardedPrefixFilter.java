package com.openframe.authz.config.tenant;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.*;

/**
 * Ensures X-Forwarded-Prefix carries the tenant segment so Spring Authorization Server
 * computes issuer as https://host/{tenant} even when AS is accessed directly (no gateway).
 * <p>
 * Order: must run AFTER TenantContextFilter (which sets tenant in context/session)
 * and BEFORE ForwardedHeaderFilter (which consumes the headers).
 */
public class TenantForwardedPrefixFilter extends OncePerRequestFilter {

    private static final String X_FORWARDED_PREFIX = "X-Forwarded-Prefix";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String tenantId = TenantContext.getTenantId();
        String existing = request.getHeader(X_FORWARDED_PREFIX);
        String requestUri = request.getRequestURI();
        String contextPath = request.getContextPath();
        String path;
        if (requestUri == null) {
            path = "/";
        } else if (contextPath != null && !contextPath.isEmpty() && requestUri.startsWith(contextPath)) {
            path = requestUri.substring(contextPath.length());
            if (path.isEmpty()) path = "/";
        } else {
            path = requestUri;
        }

        boolean sasEndpoint = path.contains("/.well-known/") || path.startsWith("/oauth2/") || path.startsWith("/connect/") || path.equals("/userinfo");

        boolean pathAlreadyPrefixed = tenantId != null && path.startsWith("/" + tenantId + "/");

        if (!sasEndpoint || tenantId == null || tenantId.isBlank() || pathAlreadyPrefixed
                || (existing != null && !existing.isBlank())) {
            filterChain.doFilter(request, response);
            return;
        }

        String prefix = "/" + tenantId;
        HttpServletRequest wrapped = new AddHeaderRequestWrapper(request, X_FORWARDED_PREFIX, prefix);
        filterChain.doFilter(wrapped, response);
    }

    private static class AddHeaderRequestWrapper extends HttpServletRequestWrapper {
        private final Map<String, List<String>> extraHeaders = new HashMap<>();

        AddHeaderRequestWrapper(HttpServletRequest request, String name, String value) {
            super(request);
            extraHeaders.put(name, List.of(value));
        }

        @Override
        public String getHeader(String name) {
            List<String> values = extraHeaders.get(name);
            if (values != null && !values.isEmpty()) {
                return values.getFirst();
            }
            return super.getHeader(name);
        }

        @Override
        public Enumeration<String> getHeaders(String name) {
            List<String> values = extraHeaders.get(name);
            if (values != null) {
                return Collections.enumeration(values);
            }
            return super.getHeaders(name);
        }

        @Override
        public Enumeration<String> getHeaderNames() {
            Set<String> names = new LinkedHashSet<>();
            Enumeration<String> original = super.getHeaderNames();
            while (original.hasMoreElements()) {
                names.add(original.nextElement());
            }
            names.addAll(extraHeaders.keySet());
            return Collections.enumeration(names);
        }
    }
}


