package com.openframe.api.service.device;

import com.openframe.api.event.DeviceNicknameUpdatedEvent;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;

import static com.openframe.data.repository.redis.MachineIdCacheService.INVALIDATION_CHANNEL;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class MachineCacheInvalidationPublisherTest {

    private static final String MACHINE_ID = "6d925893-702a-4223-b62f-2f80b927cbaa";

    @Mock
    private StringRedisTemplate redisTemplate;

    @InjectMocks
    private MachineCacheInvalidationPublisher publisher;

    @Test
    @DisplayName("onNicknameUpdated: forwards the machineId on the global invalidation channel the stream services subscribe to")
    void onNicknameUpdated_publishesMachineIdOnGlobalChannel() {
        publisher.onNicknameUpdated(new DeviceNicknameUpdatedEvent(this, MACHINE_ID));

        verify(redisTemplate).convertAndSend(INVALIDATION_CHANNEL, MACHINE_ID);
    }

    @Test
    @DisplayName("onNicknameUpdated: a Redis failure never propagates — the rename is already persisted and the cache TTL covers it")
    void onNicknameUpdated_redisFailureDoesNotPropagate() {
        doThrow(new RedisConnectionFailureException("redis down"))
                .when(redisTemplate).convertAndSend(any(), any());

        assertThatCode(() -> publisher.onNicknameUpdated(new DeviceNicknameUpdatedEvent(this, MACHINE_ID)))
                .doesNotThrowAnyException();
    }
}
