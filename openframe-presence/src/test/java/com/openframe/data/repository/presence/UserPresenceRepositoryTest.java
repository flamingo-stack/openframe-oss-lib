package com.openframe.data.repository.presence;

import com.openframe.data.config.PresenceProperties;
import com.openframe.data.redis.OpenframeRedisKeyBuilder;
import com.openframe.data.redis.OpenframeRedisProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserPresenceRepositoryTest {

    // The full key shape is the cross-writer contract — assert it literally, not via the builder.
    private static final String EXPECTED_KEY = "of:{tenant-1}:presence:user:user-1";

    @Mock
    private RedisTemplate<String, String> redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    private UserPresenceRepository repository;

    @BeforeEach
    void setUp() {
        OpenframeRedisProperties redisProperties = new OpenframeRedisProperties();
        redisProperties.setTenantId("tenant-1");
        OpenframeRedisKeyBuilder keyBuilder = new OpenframeRedisKeyBuilder(redisProperties);
        PresenceProperties presenceProperties = new PresenceProperties();
        presenceProperties.setTtlSeconds(30);
        repository = new UserPresenceRepository(redisTemplate, keyBuilder, presenceProperties);
    }

    @Test
    void mark_present_writes_epoch_value_under_tenant_key_with_configured_ttl() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);

        repository.markPresent("user-1");

        ArgumentCaptor<String> value = ArgumentCaptor.forClass(String.class);
        verify(valueOperations).set(eq(EXPECTED_KEY), value.capture(), eq(Duration.ofSeconds(30)));
        assertTrue(Long.parseLong(value.getValue()) > 0);
    }

    @Test
    void is_present_when_key_exists() {
        when(redisTemplate.hasKey(EXPECTED_KEY)).thenReturn(true);

        assertTrue(repository.isPresent("user-1"));
    }

    @Test
    void is_absent_when_key_missing() {
        when(redisTemplate.hasKey(EXPECTED_KEY)).thenReturn(false);

        assertFalse(repository.isPresent("user-1"));
    }

    @Test
    void is_absent_when_redis_returns_null() {
        when(redisTemplate.hasKey(EXPECTED_KEY)).thenReturn(null);

        assertFalse(repository.isPresent("user-1"));
    }

    @Test
    void find_last_seen_parses_the_stored_epoch_millis() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(EXPECTED_KEY)).thenReturn("1700000000000");

        Optional<Instant> lastSeen = repository.findLastSeen("user-1");

        assertEquals(Optional.of(Instant.ofEpochMilli(1_700_000_000_000L)), lastSeen);
    }

    @Test
    void find_last_seen_is_empty_when_key_missing() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(EXPECTED_KEY)).thenReturn(null);

        assertEquals(Optional.empty(), repository.findLastSeen("user-1"));
    }
}
