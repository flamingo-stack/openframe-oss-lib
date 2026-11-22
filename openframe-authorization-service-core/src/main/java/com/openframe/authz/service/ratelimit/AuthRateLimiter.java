package com.openframe.authz.service.ratelimit;

import com.openframe.data.redis.OpenframeRedisKeyBuilder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.List;

/**
 * Windowed Redis counters for the auth limits. Fails open: a Redis error never blocks a login or a reset,
 * it only logs a WARN and reports a zero count.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AuthRateLimiter {

    private static final String KEY_PREFIX = "auth-limit:";

    // One round trip, atomic: the first hit (or a key that lost its TTL) starts the window
    private static final RedisScript<Long> INCREMENT = RedisScript.of("""
            local count = redis.call('INCR', KEYS[1])
            if count == 1 or redis.call('TTL', KEYS[1]) == -1 then
              redis.call('EXPIRE', KEYS[1], ARGV[1])
            end
            return count""", Long.class);

    // Never recreates an expired key, which would then live without a TTL
    private static final RedisScript<Long> DECREMENT = RedisScript.of("""
            if redis.call('EXISTS', KEYS[1]) == 1 then
              return redis.call('DECR', KEYS[1])
            end
            return 0""", Long.class);

    private final RedisTemplate<String, String> redisTemplate;
    private final OpenframeRedisKeyBuilder keyBuilder;

    /** Counts one hit in the window and returns the new count. */
    public long increment(String relativeKey, Duration window) {
        try {
            Long count = redisTemplate.execute(INCREMENT, List.of(key(relativeKey)), String.valueOf(window.toSeconds()));
            return count == null ? 0 : count;
        } catch (RuntimeException e) {
            log.warn("Auth rate limit skipped, Redis unavailable: {}", e.getMessage());
            return 0;
        }
    }

    /** Gives back one hit that turned out not to count. */
    public void decrement(String relativeKey) {
        try {
            redisTemplate.execute(DECREMENT, List.of(key(relativeKey)));
        } catch (RuntimeException e) {
            log.warn("Auth rate limit hit not given back, Redis unavailable: {}", e.getMessage());
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
