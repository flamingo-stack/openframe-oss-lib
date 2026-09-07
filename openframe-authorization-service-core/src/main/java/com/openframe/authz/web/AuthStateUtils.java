package com.openframe.authz.web;


import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import com.openframe.core.constants.SsoFlowCookieNames;

public final class AuthStateUtils {
    private AuthStateUtils() {
    }

    public static final String JSESSIONID = "JSESSIONID";

    /**
     * Drops any SSO flow cookie other than the one about to be issued. Without this an abandoned flow
     * leaves its cookie alive for the full TTL, and the callback then has two flows to choose between.
     */
    public static void clearOtherSsoFlowCookies(HttpServletResponse response, String keepCookieName) {
        for (String name : SsoFlowCookieNames.ALL) {
            if (!name.equals(keepCookieName)) {
                clearCookie(response, name);
            }
        }
    }

    /**
     * Drops every SSO flow cookie. Used on flow failure: a cookie that outlives its failed flow
     * keeps injecting its state into subsequent logins and steals their callbacks.
     */
    public static void clearSsoFlowCookies(HttpServletResponse response) {
        for (String name : SsoFlowCookieNames.ALL) {
            clearCookie(response, name);
        }
    }

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
