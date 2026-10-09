package com.openframe.authz.util;

import com.openframe.authz.config.oidc.AppleSSOProperties;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

// Apple sends the user's name only once, as a one-time "user" form parameter on first callback.
public final class AppleUserParam {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private AppleUserParam() {
    }

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

    public static String[] parseNamesFromCurrentRequest() {
        return RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs
                ? parseNames(attrs.getRequest())
                : null;
    }

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
