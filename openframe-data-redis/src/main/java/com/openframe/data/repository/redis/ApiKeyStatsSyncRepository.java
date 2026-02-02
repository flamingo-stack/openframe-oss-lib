package com.openframe.data.repository.redis;

import com.openframe.data.redis.OpenframeRedisKeyBuilder;
import com.openframe.data.redis.OpenframeRedisProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

import java.util.Map;
import java.util.Set;

/**
 * Repository for API key statistics synchronization using blocking Redis operations
 */
@Repository
@Slf4j
@RequiredArgsConstructor
public class ApiKeyStatsSyncRepository {

    private final StringRedisTemplate redisTemplate;
    private final OpenframeRedisProperties redisProperties;
    private final OpenframeRedisKeyBuilder keyBuilder;

    /**
     * Get all stats keys from Redis
     */
    public Set<String> getAllStatsKeys() {
        return redisTemplate.keys(statsKeyPrefix() + ":*");
    }

    /**
     * Get all hash entries for a stats key
     */
    public Map<Object, Object> getStatsData(String redisKey) {
        return redisTemplate.opsForHash().entries(redisKey);
    }

    /**
     * Delete a stats key from Redis
     */
    public Boolean deleteStatsKey(String redisKey) {
        return redisTemplate.delete(redisKey);
    }

    /**
     * Extract key ID from Redis key
     */
    public String extractKeyId(String redisKey) {
        String p = statsKeyPrefix() + ":";
        return redisKey != null && redisKey.startsWith(p) ? redisKey.substring(p.length()) : redisKey;
    }

    private String statsKeyPrefix() {
        return keyBuilder.tenantKey(redisProperties.getKeys().getApiKeyStatsPrefix());
    }

    /**
     * Parse Long value from Redis data
     */
    public Long getLong(Map<Object, Object> data, String key) {
        Object value = data.get(key);
        if (value == null) return 0L;
        try {
            return Long.parseLong(value.toString());
        } catch (NumberFormatException e) {
            log.warn("Failed to parse long value: {} for key: {}", value, key);
            return 0L;
        }
    }

    /**
     * Parse String value from Redis data
     */
    public String getString(Map<Object, Object> data, String key) {
        Object value = data.get(key);
        return value != null ? value.toString() : null;
    }
}

