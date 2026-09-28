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

    private final MachineIdCacheService machineIdCacheService;

    @Override
    public void onMessage(Message message, byte[] pattern) {
        String machineId = new String(message.getBody(), StandardCharsets.UTF_8);
        log.info("Received machine cache invalidation: machineId={}", machineId);
        machineIdCacheService.evictMachine(machineId);
    }
}
