package com.openframe.authz.security;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;

import java.util.Optional;

@Slf4j
public final class CookieHelper {

    private CookieHelper() {
    }

    public static Optional<Cookie> findCookie(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return Optional.empty();
        for (Cookie c : cookies) {
            if (name.equals(c.getName())) return Optional.of(c);
        }
        return Optional.empty();
    }
}
