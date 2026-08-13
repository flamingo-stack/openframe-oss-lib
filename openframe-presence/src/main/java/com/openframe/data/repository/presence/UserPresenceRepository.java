package com.openframe.data.repository.presence;

import com.openframe.data.config.PresenceProperties;
import com.openframe.data.redis.OpenframeRedisKeyBuilder;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Repository;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class UserPresenceRepository {

    private static final String USER_KEY_PREFIX = "presence:user:";

    private final RedisTemplate<String, String> redisTemplate;
    private final OpenframeRedisKeyBuilder keyBuilder;
    private final PresenceProperties properties;

    public void markPresent(String userId) {
        String key = userKey(userId);
        long nowMillis = System.currentTimeMillis();
        String lastSeen = String.valueOf(nowMillis);
        long ttlSeconds = properties.getTtlSeconds();
        Duration ttl = Duration.ofSeconds(ttlSeconds);
        redisTemplate.opsForValue().set(key, lastSeen, ttl);
    }

    public boolean isPresent(String userId) {
        String key = userKey(userId);
        Boolean keyExists = redisTemplate.hasKey(key);
        return Boolean.TRUE.equals(keyExists);
    }

    public Optional<Instant> findLastSeen(String userId) {
        String key = userKey(userId);
        String lastSeenMillis = redisTemplate.opsForValue().get(key);
        if (lastSeenMillis == null) {
            return Optional.empty();
        }
        long epochMillis = Long.parseLong(lastSeenMillis);
        Instant lastSeen = Instant.ofEpochMilli(epochMillis);
        return Optional.of(lastSeen);
    }

    private String userKey(String userId) {
        return keyBuilder.tenantKey(USER_KEY_PREFIX + userId);
    }
}
