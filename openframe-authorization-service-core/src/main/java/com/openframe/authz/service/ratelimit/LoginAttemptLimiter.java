package com.openframe.authz.service.ratelimit;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Locale;

import static com.openframe.authz.service.ratelimit.AuthRateLimiter.hash;

/**
 * Failed password logins per account (tenant + email hash) and per client IP. Reaching the limit blocks for
 * one window from that failure; failures while blocked aren't counted, so nobody can keep an account locked.
 */
@Component
@Slf4j
public class LoginAttemptLimiter {

    private final AuthRateLimiter rateLimiter;
    private final int maxAccountFailures;
    private final int maxIpFailures;
    private final Duration window;

    public LoginAttemptLimiter(AuthRateLimiter rateLimiter,
                               @Value("${openframe.login.limit.account-max-failures:10}") int maxAccountFailures,
                               @Value("${openframe.login.limit.ip-max-failures:50}") int maxIpFailures,
                               @Value("${openframe.login.limit.window:15m}") Duration window) {
        this.rateLimiter = rateLimiter;
        this.maxAccountFailures = maxAccountFailures;
        this.maxIpFailures = maxIpFailures;
        this.window = window;
    }

    public boolean isBlocked(String tenantId, String email, String ip) {
        return rateLimiter.count(accountKey(tenantId, email)) >= maxAccountFailures
                || ip != null && rateLimiter.count(ipKey(ip)) >= maxIpFailures;
    }

    public void recordFailure(String tenantId, String email, String ip) {
        countFailure(accountKey(tenantId, email), maxAccountFailures, "account", tenantId, ip);
        if (ip != null) {
            countFailure(ipKey(ip), maxIpFailures, "ip", tenantId, ip);
        }
    }

    public void clearAccount(String tenantId, String email) {
        rateLimiter.clear(accountKey(tenantId, email));
    }

    private void countFailure(String key, int max, String scope, String tenantId, String ip) {
        if (rateLimiter.count(key) >= max) {
            return;
        }
        if (rateLimiter.increment(key, window) == max) {
            rateLimiter.restartWindow(key, window);
            log.warn("event=password_login_blocked scope={} tenantId={} ip={} minutes={}", scope, tenantId, ip,
                    window.toMinutes());
        }
    }

    private static String accountKey(String tenantId, String email) {
        return "login:account:" + tenantId + ":" + hash(email.toLowerCase(Locale.ROOT));
    }

    private static String ipKey(String ip) {
        return "login:ip:" + ip;
    }
}
