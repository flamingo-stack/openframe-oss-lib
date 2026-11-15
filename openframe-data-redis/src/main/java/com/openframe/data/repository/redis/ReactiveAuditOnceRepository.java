package com.openframe.data.repository.redis;

import com.openframe.data.redis.OpenframeRedisKeyBuilder;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;

import java.time.Duration;

@Repository
@RequiredArgsConstructor
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.REACTIVE)
public class ReactiveAuditOnceRepository {

    private static final String PREFIX = "audit:once:";

    private final ReactiveStringRedisTemplate redisTemplate;
    private final OpenframeRedisKeyBuilder keyBuilder;

    public Mono<Boolean> claim(String key, Duration window, String tenantId) {
        String relativeKey = PREFIX + key;
        String redisKey = tenantId != null
                ? keyBuilder.tenantKey(relativeKey, tenantId)
                : keyBuilder.tenantKey(relativeKey);
        return redisTemplate.opsForValue().setIfAbsent(redisKey, "1", window);
    }
}
