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
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
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
                    new GenericJackson2JsonRedisSerializer()))
                // NOTE: tenant id is intentionally not passed here — cacheKeyPrefix
                // is expected to resolve the current tenant internally (e.g. via a
                // TenantIdProvider/context) rather than accept it as a parameter from
                // a cache key-prefix callback, which has no access to per-request
                // tenant context. Passing a hardcoded null here previously produced
                // a misleading comment claiming tenant-aware keys while always using
                // a null tenant. If OpenframeRedisKeyBuilder.cacheKeyPrefix does NOT
                // resolve tenant internally, this MUST be revisited to avoid a
                // cross-tenant cache key collision.
                .computePrefixWith(cacheName -> keyBuilder.cacheKeyPrefix(cacheName));

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

