package com.openframe.authz.service.ratelimit;

import com.openframe.data.redis.OpenframeRedisKeyBuilder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;

/**
 * Windowed Redis counters for the auth limits. Fails open: a Redis error never blocks a login or a reset,
 * it only logs a WARN and reports a zero count.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AuthRateLimiter {

    private static final String KEY_PREFIX = "auth-limit:";
    private static final long NO_EXPIRY = -1L;

    private final RedisTemplate<String, String> redisTemplate;
    private final OpenframeRedisKeyBuilder keyBuilder;

    /** Counts one hit in the window (started by the first hit) and returns the new count. */
    public long increment(String relativeKey, Duration window) {
        String key = key(relativeKey);
        try {
            Long count = redisTemplate.opsForValue().increment(key);
            long value = count == null ? 0 : count;
            if (value == 1 || Long.valueOf(NO_EXPIRY).equals(redisTemplate.getExpire(key))) {
                redisTemplate.expire(key, window);
            }
            return value;
        } catch (RuntimeException e) {
            log.warn("Auth rate limit skipped, Redis unavailable: {}", e.getMessage());
            return 0;
        }
    }

    public long count(String relativeKey) {
        try {
            String value = redisTemplate.opsForValue().get(key(relativeKey));
            return value == null ? 0 : Long.parseLong(value);
        } catch (RuntimeException e) {
            log.warn("Auth rate limit skipped, Redis unavailable: {}", e.getMessage());
            return 0;
        }
    }

    public void restartWindow(String relativeKey, Duration window) {
        try {
            redisTemplate.expire(key(relativeKey), window);
        } catch (RuntimeException e) {
            log.warn("Auth rate limit window not restarted, Redis unavailable: {}", e.getMessage());
        }
    }

    public void clear(String relativeKey) {
        try {
            redisTemplate.delete(key(relativeKey));
        } catch (RuntimeException e) {
            log.warn("Auth rate limit not cleared, Redis unavailable: {}", e.getMessage());
        }
    }

    /** Keys and logs carry this instead of an email. */
    public static String hash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }

    private String key(String relativeKey) {
        return keyBuilder.globalKey(KEY_PREFIX + relativeKey);
    }
}
