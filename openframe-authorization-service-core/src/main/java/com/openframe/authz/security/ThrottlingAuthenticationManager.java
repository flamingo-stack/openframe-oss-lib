package com.openframe.authz.security;

import com.openframe.authz.config.tenant.TenantContext;
import com.openframe.authz.service.ratelimit.LoginAttemptLimiter;
import com.openframe.authz.service.ratelimit.LoginAttemptLimiter.Attempt;
import com.openframe.authz.web.ClientIp;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Objects;

/**
 * Password login with the attempt limits in front. A blocked attempt fails exactly like a wrong password:
 * same exception and message, and one password hash check so it takes as long; it reveals neither the
 * block nor the account.
 */
public class ThrottlingAuthenticationManager implements AuthenticationManager {

    /** DaoAuthenticationProvider's own wording for a wrong password. */
    private static final String BAD_CREDENTIALS = "Bad credentials";

    private final AuthenticationManager delegate;
    private final LoginAttemptLimiter limiter;
    private final PasswordEncoder passwordEncoder;
    private final String decoyHash;

    public ThrottlingAuthenticationManager(AuthenticationManager delegate, LoginAttemptLimiter limiter,
                                           PasswordEncoder passwordEncoder) {
        this.delegate = delegate;
        this.limiter = limiter;
        this.passwordEncoder = passwordEncoder;
        this.decoyHash = passwordEncoder.encode("decoy-password-for-blocked-login");
    }

    @Override
    public Authentication authenticate(Authentication authentication) {
        String tenantId = TenantContext.getTenantId();
        String email = authentication.getName();
        String ip = ClientIp.current();
        Attempt attempt = limiter.tryAcquire(tenantId, email, ip).orElseThrow(() -> refuse(authentication));
        try {
            Authentication result = delegate.authenticate(authentication);
            limiter.onSuccess(attempt);
            return result;
        } catch (BadCredentialsException e) {
            limiter.onBadPassword(attempt);
            throw e;
        } catch (AuthenticationException e) {
            limiter.release(attempt);
            throw e;
        }
    }

    private BadCredentialsException refuse(Authentication authentication) {
        passwordEncoder.matches(Objects.toString(authentication.getCredentials(), ""), decoyHash);
        return new BadCredentialsException(BAD_CREDENTIALS);
    }
}
