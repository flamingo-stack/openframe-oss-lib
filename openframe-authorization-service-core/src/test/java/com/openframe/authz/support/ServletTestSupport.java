package com.openframe.authz.support;

import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Binds a mock request to the current thread, as the servlet container does, so helpers that
 * build absolute URLs from the current request ({@code Redirects.foundAtRoot}) work in unit tests.
 */
public final class ServletTestSupport {

    private ServletTestSupport() {
    }

    public static MockHttpServletRequest bind(MockHttpServletRequest request) {
        request.setScheme("https");
        request.setServerName("auth.example.com");
        request.setServerPort(443);
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
        return request;
    }

    public static void unbind() {
        RequestContextHolder.resetRequestAttributes();
    }
}
