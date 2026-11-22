package com.openframe.authz.security;

import com.openframe.authz.config.tenant.TenantContext;
import com.openframe.authz.service.ratelimit.LoginAttemptLimiter;
import com.openframe.authz.web.ClientIp;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;

/**
 * Password login with the failure limits in front. A blocked attempt fails exactly like a wrong password
 * (same exception and message, password not checked), so it reveals neither the block nor the account.
 */
@RequiredArgsConstructor
public class ThrottlingAuthenticationManager implements AuthenticationManager {

    // DaoAuthenticationProvider's own wording for a wrong password
    private static final String BAD_CREDENTIALS = "Bad credentials";

    private final AuthenticationManager delegate;
    private final LoginAttemptLimiter limiter;

    @Override
    public Authentication authenticate(Authentication authentication) {
        String tenantId = TenantContext.getTenantId();
        String email = authentication.getName();
        String ip = ClientIp.current();
        if (limiter.isBlocked(tenantId, email, ip)) {
            throw new BadCredentialsException(BAD_CREDENTIALS);
        }
        try {
            Authentication result = delegate.authenticate(authentication);
            limiter.clearAccount(tenantId, email);
            return result;
        } catch (BadCredentialsException e) {
            limiter.recordFailure(tenantId, email, ip);
            throw e;
        }
    }
}
