package com.openframe.data.config;

import com.openframe.data.redis.OpenframeRedisKeyBuilder;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJacksonJsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;
import java.util.Map;

/**
 * Configuration for Spring Cache with Redis
 */
@Configuration
@EnableCaching
@ConditionalOnProperty(name = "spring.redis.enabled", havingValue = "true")
public class CacheConfig {

    @Bean
    @ConditionalOnMissingBean(CacheManager.class)
    public CacheManager cacheManager(RedisConnectionFactory redisConnectionFactory,
                                     OpenframeRedisKeyBuilder keyBuilder) {
        RedisCacheConfiguration defaultConfig = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofHours(6))
            .disableCachingNullValues()
            .serializeKeysWith(RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer()))
            .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(
                    GenericJacksonJsonRedisSerializer.builder()
                            // Same as the Jackson 2 serializer's no-arg default: "@class" type info, cached nulls
                            .enableUnsafeDefaultTyping()
                            .enableSpringCacheNullValueSupport()
                            .build()))
                // Ensures all cache keys are tenant-aware by default:
                // <prefix>:<cacheName>::<key>
                .computePrefixWith(cacheName -> keyBuilder.cacheKeyPrefix(null, cacheName));

        // Shorter TTL for Fleet caches — policies and queries can be renamed/deleted
        RedisCacheConfiguration fleetCacheConfig = defaultConfig.entryTtl(Duration.ofHours(1));

        return RedisCacheManager.builder(redisConnectionFactory)
            .cacheDefaults(defaultConfig)
            .withInitialCacheConfigurations(Map.of(
                    "fleetPolicyCache", fleetCacheConfig,
                    "fleetQueryCache", fleetCacheConfig
            ))
            .build();
    }
}

