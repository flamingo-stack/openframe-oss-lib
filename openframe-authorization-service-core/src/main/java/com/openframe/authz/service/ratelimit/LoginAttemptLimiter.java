package com.openframe.authz.service.ratelimit;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Locale;

import static com.openframe.authz.service.ratelimit.AuthRateLimiter.hash;

/**
 * Password login attempts per account (tenant + email hash) and per client IP. An attempt is reserved
 * before the password is checked, so parallel guesses can't slip past the limit; a success or a refusal
 * that isn't about the password gives it back. Reaching the limit blocks for one window from that
 * attempt; refused attempts don't restart it, so nobody can keep an account locked.
 */
@Component
@Slf4j
public class LoginAttemptLimiter {

    private final AuthRateLimiter rateLimiter;
    private final int maxAccountAttempts;
    private final int maxIpAttempts;
    private final Duration window;

    public LoginAttemptLimiter(AuthRateLimiter rateLimiter,
                               @Value("${openframe.login.limit.account-max-failures:10}") int maxAccountAttempts,
                               @Value("${openframe.login.limit.ip-max-failures:50}") int maxIpAttempts,
                               @Value("${openframe.login.limit.window:15m}") Duration window) {
        this.rateLimiter = rateLimiter;
        this.maxAccountAttempts = maxAccountAttempts;
        this.maxIpAttempts = maxIpAttempts;
        this.window = window;
    }

    /** Reserves one attempt; false when the account or the IP is blocked. */
    public boolean tryAcquire(String tenantId, String email, String ip) {
        boolean accountOpen = reserve(accountKey(tenantId, email), maxAccountAttempts, "account", tenantId, ip);
        boolean ipOpen = ip == null || reserve(ipKey(ip), maxIpAttempts, "ip", tenantId, ip);
        return accountOpen && ipOpen;
    }

    public void onSuccess(String tenantId, String email, String ip) {
        clearAccount(tenantId, email);
        if (ip != null) {
            rateLimiter.decrement(ipKey(ip));
        }
    }

    /** Gives back an attempt that ended without a password verdict (tenant inactive, login disabled). */
    public void release(String tenantId, String email, String ip) {
        rateLimiter.decrement(accountKey(tenantId, email));
        if (ip != null) {
            rateLimiter.decrement(ipKey(ip));
        }
    }

    public void clearAccount(String tenantId, String email) {
        rateLimiter.clear(accountKey(tenantId, email));
    }

    private boolean reserve(String key, int max, String scope, String tenantId, String ip) {
        long attempts = rateLimiter.increment(key, window);
        if (attempts == max) {
            rateLimiter.restartWindow(key, window);
            log.warn("event=password_login_blocked scope={} tenantId={} ip={} minutes={}", scope, tenantId, ip,
                    window.toMinutes());
        }
        return attempts <= max;
    }

    private static String accountKey(String tenantId, String email) {
        return "login:account:" + tenantId + ":" + hash(email.toLowerCase(Locale.ROOT));
    }

    private static String ipKey(String ip) {
        return "login:ip:" + ip;
    }
}
