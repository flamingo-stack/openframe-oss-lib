package com.openframe.authz.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;

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
