package com.openframe.client.service.rmm;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class ScriptDeliveryRetryStore {

    private static final String KEY_PREFIX = "rmm:script:retry:";

    private final RedisTemplate<String, String> redisTemplate;
    private final ObjectMapper objectMapper;

    @Value("${openframe.rmm.execution.retry.ttl-seconds}")
    private long ttlSeconds;

    public void store(String executionId, String machineId, ScriptScheduleExecutionMessage message) {
        write(executionId, machineId, new RetryState(0, message));
    }

    public Optional<RetryState> get(String executionId, String machineId) {
        String json = redisTemplate.opsForValue().get(key(executionId, machineId));
        if (json == null) {
            return Optional.empty();
        }
        try {
            return Optional.of(objectMapper.readValue(json, RetryState.class));
        } catch (Exception e) {
            log.warn("Corrupt retry-state for executionId={} machineId={}: {}", executionId, machineId, e.getMessage());
            return Optional.empty();
        }
    }

    public int incrementRetryCount(String executionId, String machineId, RetryState current) {
        RetryState next = new RetryState(current.retryCount() + 1, current.message());
        write(executionId, machineId, next);
        return next.retryCount();
    }

    public void evict(String executionId, String machineId) {
        redisTemplate.delete(key(executionId, machineId));
    }

    private void write(String executionId, String machineId, RetryState state) {
        try {
            redisTemplate.opsForValue().set(key(executionId, machineId),
                    objectMapper.writeValueAsString(state), Duration.ofSeconds(ttlSeconds));
        } catch (Exception e) {
            log.warn("Failed to write retry-state executionId={} machineId={}: {}", executionId, machineId, e.getMessage());
        }
    }

    private static String key(String executionId, String machineId) {
        return KEY_PREFIX + executionId + ":" + machineId;
    }

    public record RetryState(int retryCount, ScriptScheduleExecutionMessage message) {}
}
