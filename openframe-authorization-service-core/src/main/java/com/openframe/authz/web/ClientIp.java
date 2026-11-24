package com.openframe.authz.web;

import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletRequestWrapper;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * The caller's IP for auth log lines. A deployment that knows it better (behind a gateway that overwrites
 * X-Client-IP) stores it under {@link #ATTRIBUTE}; otherwise the container's remote address.
 */
public final class ClientIp {

    public static final String ATTRIBUTE = ClientIp.class.getName();

    private ClientIp() {
    }

    /** The current request's IP; null off the request thread. */
    public static String current() {
        return RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes
                ? of(attributes.getRequest())
                : null;
    }

    // Unwrapped: ForwardedHeaderFilter's copy reports the left-most, forgeable X-Forwarded-For entry
    public static String of(ServletRequest request) {
        if (request == null) {
            return null;
        }
        if (request.getAttribute(ATTRIBUTE) instanceof String ip) {
            return ip;
        }
        ServletRequest inner = request;
        while (inner instanceof ServletRequestWrapper wrapper) {
            inner = wrapper.getRequest();
        }
        return inner.getRemoteAddr();
    }
}
