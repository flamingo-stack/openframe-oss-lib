package com.openframe.authz.service.ratelimit;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Locale;
import java.util.Optional;

import static com.openframe.authz.service.ratelimit.AuthRateLimiter.hash;

/**
 * Password login attempts per account (tenant + email hash) and per client IP. An attempt is reserved
 * before the password is checked, so parallel guesses can't slip past the limit. Only a wrong password
 * keeps its reservation; a refusal, a success or a refusal that isn't about the password gives it back.
 * The wrong password that reaches the limit blocks for one window from that attempt. Refused attempts
 * don't extend the block, so a locked account opens again after one window.
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

    /** A reserved attempt and the counts it reserved at; the ip count is 0 when there is no IP. */
    public record Attempt(String tenantId, String email, String ip, long accountCount, long ipCount) {
    }

    /** Reserves one attempt; empty, with nothing kept, when the account or the IP is blocked. */
    public Optional<Attempt> tryAcquire(String tenantId, String email, String ip) {
        long accountCount = rateLimiter.increment(accountKey(tenantId, email), window);
        long ipCount = ip == null ? 0 : rateLimiter.increment(ipKey(ip), window);
        Attempt attempt = new Attempt(tenantId, email, ip, accountCount, ipCount);
        if (accountCount > maxAccountAttempts || ipCount > maxIpAttempts) {
            release(attempt);
            return Optional.empty();
        }
        return Optional.of(attempt);
    }

    /** Keeps the attempt; the one that reached a limit starts the block. */
    public void onBadPassword(Attempt attempt) {
        if (attempt.accountCount() == maxAccountAttempts) {
            block(accountKey(attempt.tenantId(), attempt.email()), "account", attempt);
        }
        if (attempt.ip() != null && attempt.ipCount() == maxIpAttempts) {
            block(ipKey(attempt.ip()), "ip", attempt);
        }
    }

    public void onSuccess(Attempt attempt) {
        clearAccount(attempt.tenantId(), attempt.email());
        if (attempt.ip() != null) {
            rateLimiter.decrement(ipKey(attempt.ip()));
        }
    }

    /** Gives back an attempt that ended without a password verdict (refused, tenant inactive, login disabled). */
    public void release(Attempt attempt) {
        rateLimiter.decrement(accountKey(attempt.tenantId(), attempt.email()));
        if (attempt.ip() != null) {
            rateLimiter.decrement(ipKey(attempt.ip()));
        }
    }

    public void clearAccount(String tenantId, String email) {
        rateLimiter.clear(accountKey(tenantId, email));
    }

    private void block(String key, String scope, Attempt attempt) {
        rateLimiter.restartWindow(key, window);
        log.warn("event=password_login_blocked scope={} tenantId={} ip={} minutes={}", scope, attempt.tenantId(),
                attempt.ip(), window.toMinutes());
    }

    private static String accountKey(String tenantId, String email) {
        return "login:account:" + tenantId + ":" + hash(email.toLowerCase(Locale.ROOT));
    }

    private static String ipKey(String ip) {
        return "login:ip:" + ip;
    }
}
