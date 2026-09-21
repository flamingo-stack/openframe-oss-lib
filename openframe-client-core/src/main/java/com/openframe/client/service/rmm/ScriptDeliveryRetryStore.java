package com.openframe.client.service.rmm;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.rmm.script.DeliveryChannel;
import com.openframe.data.document.rmm.script.ScriptDeliveryRetry;
import com.openframe.data.repository.rmm.ScriptDeliveryRetryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class ScriptDeliveryRetryStore {

    private final ScriptDeliveryRetryRepository repository;
    private final ObjectMapper objectMapper;

    @Value("${openframe.rmm.execution.retry.ttl-seconds}")
    private long ttlSeconds;

    public void store(String executionId, String machineId, DeliveryChannel channel, Object message) {
        try {
            write(executionId, machineId, 0, channel, objectMapper.writeValueAsString(message));
        } catch (Exception e) {
            log.warn("Failed to serialize retry-state executionId={} machineId={} channel={}: {}",
                    executionId, machineId, channel, e.getMessage());
        }
    }

    public Optional<RetryState> get(String executionId, String machineId) {
        return repository.findById(id(executionId, machineId)).map(this::toState);
    }

    public int incrementRetryCount(String executionId, String machineId, RetryState current) {
        int next = current.retryCount() + 1;
        write(executionId, machineId, next, current.channel(), current.messageJson());
        return next;
    }

    public void evict(String executionId, String machineId) {
        repository.deleteById(id(executionId, machineId));
    }

    private void write(String executionId, String machineId, int retryCount, DeliveryChannel channel, String messageJson) {
        try {
            repository.save(ScriptDeliveryRetry.builder()
                    .id(id(executionId, machineId))
                    .executionId(executionId)
                    .machineId(machineId)
                    .retryCount(retryCount)
                    .channel(channel)
                    .messageJson(messageJson)
                    .expiresAt(Instant.now().plusSeconds(ttlSeconds))
                    .build());
        } catch (Exception e) {
            log.warn("Failed to write retry-state executionId={} machineId={}: {}", executionId, machineId, e.getMessage());
        }
    }

    private RetryState toState(ScriptDeliveryRetry row) {
        DeliveryChannel channel = row.getChannel() != null ? row.getChannel() : DeliveryChannel.SCHEDULE;
        return new RetryState(row.getRetryCount(), channel, row.getMessageJson());
    }

    private static String id(String executionId, String machineId) {
        return executionId + ":" + machineId;
    }

    public record RetryState(int retryCount, DeliveryChannel channel, String messageJson) {}
}
