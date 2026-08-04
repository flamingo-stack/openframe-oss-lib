package com.openframe.authz.util;

import com.openframe.authz.config.oidc.AppleSSOProperties;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Apple sends the user's name exactly once — as a {@code user} JSON form parameter on the
 * first-ever form_post callback — and never again; the ID token itself has no name claims.
 * Shape: {@code {"name":{"firstName":"...","lastName":"..."},"email":"..."}}.
 */
public final class AppleUserParam {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private AppleUserParam() {
    }

    /**
     * Token-derived names, falling back to Apple's one-time {@code user} form parameter when the
     * token carried none. The single place that owns the gate: the fallback applies only when the
     * authenticated registration is Apple — the parameter is untrusted request input and must not
     * feed names into other providers' callbacks.
     *
     * @param request the callback request, or {@code null} to resolve the current one
     */
    public static String[] namesOrAppleFallback(String[] names, String registrationId, HttpServletRequest request) {
        if (!AppleSSOProperties.APPLE.equals(registrationId)) {
            return names;
        }
        if (!isBlank(names[0]) || !isBlank(names[1])) {
            return names;
        }
        String[] appleNames = request != null ? parseNames(request) : parseNamesFromCurrentRequest();
        return appleNames != null ? appleNames : names;
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    /**
     * Variant for call sites that sit below the servlet layer (e.g. the OIDC user service, which
     * runs on the callback request thread but is not handed the request). Resolves the current
     * request from {@link RequestContextHolder}; returns {@code null} when there is none.
     */
    public static String[] parseNamesFromCurrentRequest() {
        return RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs
                ? parseNames(attrs.getRequest())
                : null;
    }

    /**
     * @return {@code {firstName, lastName}} (either element may be null), or {@code null} when the
     * parameter is absent or unparseable
     */
    public static String[] parseNames(HttpServletRequest request) {
        String user = request.getParameter("user");
        if (user == null || user.isBlank()) {
            return null;
        }
        try {
            JsonNode name = MAPPER.readTree(user).path("name");
            String first = name.path("firstName").asText(null);
            String last = name.path("lastName").asText(null);
            return (first == null && last == null) ? null : new String[]{first, last};
        } catch (Exception e) {
            return null;
        }
    }
}
