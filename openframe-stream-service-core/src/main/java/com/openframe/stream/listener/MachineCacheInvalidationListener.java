package com.openframe.stream.listener;

import com.openframe.data.repository.redis.MachineIdCacheService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

@Component
@Slf4j
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.machine-id.cache.enabled", havingValue = "true")
public class MachineCacheInvalidationListener implements MessageListener {

    private static final int MAX_MACHINE_ID_LENGTH = 256;

    private final MachineIdCacheService machineIdCacheService;

    @Override
    public void onMessage(Message message, byte[] pattern) {
        try {
            byte[] body = message.getBody();
            if (body == null || body.length == 0) {
                log.warn("Received empty machine cache invalidation message, skipping");
                return;
            }
            if (body.length > MAX_MACHINE_ID_LENGTH) {
                log.warn("Received oversized machine cache invalidation message: length={}, skipping", body.length);
                return;
            }
            String machineId = new String(body, StandardCharsets.UTF_8).trim();
            if (machineId.isEmpty()) {
                log.warn("Received blank machine cache invalidation message, skipping");
                return;
            }
            log.info("Received machine cache invalidation: machineId={}", machineId);
            machineIdCacheService.evictMachine(machineId);
        } catch (Exception e) {
            log.error("Failed to process machine cache invalidation message", e);
        }
    }
}
