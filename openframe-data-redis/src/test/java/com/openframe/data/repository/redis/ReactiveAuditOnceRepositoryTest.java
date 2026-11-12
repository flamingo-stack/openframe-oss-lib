package com.openframe.data.repository.redis;

import com.openframe.data.redis.OpenframeRedisKeyBuilder;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.data.redis.core.ReactiveValueOperations;
import reactor.core.publisher.Mono;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReactiveAuditOnceRepositoryTest {

    private static final Duration WINDOW = Duration.ofMinutes(1);

    @Mock private ReactiveStringRedisTemplate redisTemplate;
    @Mock private ReactiveValueOperations<String, String> valueOperations;
    @Mock private OpenframeRedisKeyBuilder keyBuilder;
    @InjectMocks private ReactiveAuditOnceRepository repository;

    @Test
    void claim_tenantGiven_claimsTheKeyUnderThatTenant() {
        when(keyBuilder.tenantKey("audit:once:auth.token.fail:203.0.113.7", "tenant-1"))
                .thenReturn("of:{tenant-1}:audit:once:auth.token.fail:203.0.113.7");
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.setIfAbsent("of:{tenant-1}:audit:once:auth.token.fail:203.0.113.7", "1", WINDOW))
                .thenReturn(Mono.just(true));

        assertThat(repository.claim("auth.token.fail:203.0.113.7", WINDOW, "tenant-1").block()).isTrue();
    }

    @Test
    void claim_noTenant_claimsTheKeyUnderTheCurrentTenant() {
        when(keyBuilder.tenantKey("audit:once:auth.token.fail:203.0.113.7"))
                .thenReturn("of:{current}:audit:once:auth.token.fail:203.0.113.7");
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.setIfAbsent("of:{current}:audit:once:auth.token.fail:203.0.113.7", "1", WINDOW))
                .thenReturn(Mono.just(false));

        assertThat(repository.claim("auth.token.fail:203.0.113.7", WINDOW, null).block()).isFalse();
    }
}
