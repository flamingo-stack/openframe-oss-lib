package com.openframe.api.service.device;

import com.openframe.api.event.DeviceNicknameUpdatedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.event.EventListener;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import static com.openframe.data.repository.redis.MachineIdCacheService.INVALIDATION_CHANNEL;

@Component
@Slf4j
@RequiredArgsConstructor
@ConditionalOnProperty(name = "spring.redis.enabled", havingValue = "true")
public class MachineCacheInvalidationPublisher {

    private final StringRedisTemplate redisTemplate;

    @EventListener
    public void onNicknameUpdated(DeviceNicknameUpdatedEvent event) {
        String machineId = event.getMachineId();
        try {
            redisTemplate.convertAndSend(INVALIDATION_CHANNEL, machineId);
            log.info("Published machine cache invalidation: machineId={}", machineId);
        } catch (Exception e) {
            log.warn("Failed to publish machine cache invalidation, cached info expires by TTL: machineId={}",
                    machineId, e);
        }
    }
}
