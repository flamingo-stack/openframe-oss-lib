package com.openframe.authz.web;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.util.WebUtils;

public final class RecaptchaSessionCookie {

    public static final String NAME = "recaptcha-ca-t";

    private RecaptchaSessionCookie() {
    }

    public static boolean presentIn(HttpServletRequest request) {
        Cookie cookie = WebUtils.getCookie(request, NAME);
        return cookie != null && cookie.getValue() != null && !cookie.getValue().isBlank();
    }
}
