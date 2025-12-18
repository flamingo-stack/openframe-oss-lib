package com.openframe.authz.web;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

public final class AuthStateUtils {
    private AuthStateUtils() {
    }

    public static final String JSESSIONID = "JSESSIONID";

    public static void clearAuthState(HttpServletRequest request, HttpServletResponse response) {
        var existing = request.getSession(false);
        if (existing != null) {
            try {
                existing.invalidate();
            } catch (Exception ignored) {
            }
        }
        clearCookie(response, JSESSIONID, "/");
        String ctx = request.getContextPath();
        if (ctx != null && !ctx.isBlank()) {
            clearCookie(response, JSESSIONID, ctx);
        }
    }

    public static void clearCookie(HttpServletResponse response, String name, String path) {
        Cookie c = new Cookie(name, "");
        c.setHttpOnly(true);
        c.setSecure(true);
        c.setPath(path);
        c.setMaxAge(0);
        response.addCookie(c);
    }

    public static void clearCookie(HttpServletResponse response, String name) {
        clearCookie(response, name, "/");
    }
}
