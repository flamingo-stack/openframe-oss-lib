package com.openframe.authz.service.user;

import com.openframe.authz.service.auth.MongoAuthorizationService;
import com.openframe.authz.service.ratelimit.AuthRateLimiter;
import com.openframe.authz.service.ratelimit.LoginAttemptLimiter;
import com.openframe.authz.service.sso.SSOConfigService;
import com.openframe.authz.web.ClientIp;
import com.openframe.core.exception.AuthFlowException;
import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.redis.OpenframeRedisKeyBuilder;
import com.openframe.data.redis.OpenframeRedisProperties;
import com.openframe.notification.mail.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;

import static com.openframe.authz.service.ratelimit.AuthRateLimiter.hash;
import static com.openframe.authz.util.ResetTokenUtil.generateResetToken;

/**
 * Password reset by email. A request never tells the caller anything: whether the email exists, is over the
 * limits or already has a live token, the controller answers 202. Logs carry an outcome, never the email.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PasswordResetService {

    private static final Duration LIMIT_WINDOW = Duration.ofHours(1);
    private static final String ACTIVE_MARK = "1";

    private final RedisTemplate<String, String> redisTemplate;
    private final OpenframeRedisProperties redisProperties;
    private final OpenframeRedisKeyBuilder keyBuilder;
    private final UserService userService;
    private final EmailService emailService;
    private final MongoAuthorizationService authorizationService;
    private final SSOConfigService ssoConfigService;
    private final AuthRateLimiter rateLimiter;
    private final LoginAttemptLimiter loginAttemptLimiter;

    @Value("${openframe.password-reset.ttlMinutes:30}")
    private int ttlMinutes;

    @Value("${openframe.password-reset.limit.per-email-per-hour:3}")
    private int maxRequestsPerEmail;

    @Value("${openframe.password-reset.limit.per-ip-per-hour:10}")
    private int maxRequestsPerIp;

    public void createResetToken(String email) {
        String ip = ClientIp.current();
        if (overLimit(email, ip)) {
            logRequest("rate_limited", List.of(), ip);
            return;
        }
        List<String> tenantIds = userService.findActiveTenantIdsByEmail(email);
        if (tenantIds.isEmpty()) {
            logRequest("unknown_email", tenantIds, ip);
            return;
        }
        if (tenantIds.stream().noneMatch(ssoConfigService::isOpenframeLoginEnabled)) {
            logRequest("login_disabled", tenantIds, ip);
            return;
        }
        String activeKey = activeKey(email);
        Duration ttl = Duration.ofMinutes(ttlMinutes);
        // Every failure below still answers 202: a 500 would tell the caller the account exists.
        // Claimed before the send, atomically: parallel requests for one email send one email
        Boolean claimed;
        try {
            claimed = redisTemplate.opsForValue().setIfAbsent(activeKey, ACTIVE_MARK, ttl);
        } catch (RuntimeException e) {
            logFailure("redis_unavailable", tenantIds, ip, e);
            return;
        }
        if (!Boolean.TRUE.equals(claimed)) {
            logRequest("token_active", tenantIds, ip);
            return;
        }

        try {
            String token = generateResetToken();
            redisTemplate.opsForValue().set(tokenKey(token), email, ttl);
            emailService.sendPasswordResetEmail(email, token);
        } catch (RuntimeException e) {
            dropActiveMark(activeKey);
            logFailure("send_failed", tenantIds, ip, e);
            return;
        }
        logRequest("sent", tenantIds, ip);
    }

    // Dropped so a retry sends; if Redis is still down, the mark expires with its TTL.
    private void dropActiveMark(String activeKey) {
        try {
            redisTemplate.delete(activeKey);
        } catch (RuntimeException e) {
            log.warn("Reset mark not dropped, Redis unavailable: {}", e.getClass().getSimpleName());
        }
    }

    public void resetPassword(String token, String newPassword) {
        String ip = ClientIp.current();
        String key = tokenKey(token);
        String email = redisTemplate.opsForValue().get(key);
        if (email == null) {
            logConfirm("invalid_token", null, ip);
            throw new IllegalArgumentException("Invalid or expired reset token");
        }

        AuthUser user;
        try {
            user = userService.findActiveByEmail(email).orElse(null);
        } catch (IllegalStateException e) {
            logConfirm("lookup_failed", null, ip);
            throw e;
        }
        if (user == null) {
            logConfirm("user_not_found", null, ip);
            throw new IllegalArgumentException("User not found for reset token");
        }

        try {
            // The switch may have been turned off after the email was sent.
            ssoConfigService.refuseUnlessOpenframeLoginEnabled(user.getTenantId());
        } catch (AuthFlowException e) {
            logConfirm("login_disabled", user, ip);
            throw e;
        }

        userService.updatePassword(user.getId(), newPassword);

        // The old password may be compromised: revoke existing sessions' refresh tokens
        int revoked = authorizationService.revokeAllForPrincipal(user.getEmail());
        log.info("Revoked {} refresh token(s) after password reset for user {} ip={}", revoked, user.getId(), ip);

        redisTemplate.delete(key);
        redisTemplate.delete(activeKey(email));
        loginAttemptLimiter.clearAccount(user.getTenantId(), email);
        logConfirm("success", user, ip);
    }

    // Both counters always move, so an unknown email costs the caller the same as a real one.
    private boolean overLimit(String email, String ip) {
        boolean emailOver = rateLimiter.increment("reset:email:" + hash(email), LIMIT_WINDOW) > maxRequestsPerEmail;
        boolean ipOver = ip != null && rateLimiter.increment("reset:ip:" + ip, LIMIT_WINDOW) > maxRequestsPerIp;
        return emailOver || ipOver;
    }

    private String tokenKey(String token) {
        return keyBuilder.tenantKey(redisProperties.getKeys().getPasswordResetPrefix() + ":" + token);
    }

    private String activeKey(String email) {
        return keyBuilder.tenantKey(redisProperties.getKeys().getPasswordResetPrefix() + ":active:" + hash(email));
    }

    private static void logRequest(String outcome, List<String> tenantIds, String ip) {
        log.info("event=password_reset_request outcome={} tenantIds={} ip={}", outcome, tenantIds, ip);
    }

    private static void logFailure(String outcome, List<String> tenantIds, String ip, RuntimeException e) {
        log.warn("event=password_reset_request outcome={} tenantIds={} ip={} error={}", outcome, tenantIds, ip,
                e.getClass().getSimpleName());
    }

    private static void logConfirm(String outcome, AuthUser user, String ip) {
        log.info("event=password_reset_confirm outcome={} userId={} tenantId={} ip={}", outcome,
                user == null ? null : user.getId(), user == null ? null : user.getTenantId(), ip);
    }
}
