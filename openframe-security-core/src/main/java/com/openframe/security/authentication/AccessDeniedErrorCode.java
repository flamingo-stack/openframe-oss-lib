package com.openframe.security.authentication;

import com.openframe.core.exception.ErrorCode;
import lombok.experimental.UtilityClass;
import org.springframework.security.authentication.AuthenticationTrustResolver;
import org.springframework.security.authentication.AuthenticationTrustResolverImpl;
import org.springframework.security.core.context.SecurityContextHolder;

@UtilityClass
public class AccessDeniedErrorCode {

    public static final String MESSAGE = "Access denied";

    private static final AuthenticationTrustResolver TRUST_RESOLVER = new AuthenticationTrustResolverImpl();

    public static ErrorCode forCurrentCaller() {
        boolean authenticated = TRUST_RESOLVER.isAuthenticated(SecurityContextHolder.getContext().getAuthentication());
        return authenticated ? ErrorCode.FORBIDDEN : ErrorCode.UNAUTHORIZED;
    }
}
