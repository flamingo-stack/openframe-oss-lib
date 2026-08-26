package com.openframe.client.service.rmm;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.rmm.script.ScriptDeliveryRetry;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionMessage;
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

    public void store(String executionId, String machineId, ScriptScheduleExecutionMessage message) {
        write(executionId, machineId, 0, message);
    }

    public Optional<RetryState> get(String executionId, String machineId) {
        return repository.findById(id(executionId, machineId)).flatMap(this::toState);
    }

    public int incrementRetryCount(String executionId, String machineId, RetryState current) {
        int next = current.retryCount() + 1;
        write(executionId, machineId, next, current.message());
        return next;
    }

    public void evict(String executionId, String machineId) {
        repository.deleteById(id(executionId, machineId));
    }

    private void write(String executionId, String machineId, int retryCount, ScriptScheduleExecutionMessage message) {
        try {
            repository.save(ScriptDeliveryRetry.builder()
                    .id(id(executionId, machineId))
                    .executionId(executionId)
                    .machineId(machineId)
                    .retryCount(retryCount)
                    .messageJson(objectMapper.writeValueAsString(message))
                    .expiresAt(Instant.now().plusSeconds(ttlSeconds))
                    .build());
        } catch (Exception e) {
            log.warn("Failed to write retry-state executionId={} machineId={}: {}", executionId, machineId, e.getMessage());
        }
    }

    private Optional<RetryState> toState(ScriptDeliveryRetry row) {
        try {
            ScriptScheduleExecutionMessage message =
                    objectMapper.readValue(row.getMessageJson(), ScriptScheduleExecutionMessage.class);
            return Optional.of(new RetryState(row.getRetryCount(), message));
        } catch (Exception e) {
            log.warn("Corrupt retry-state for executionId={} machineId={}: {}",
                    row.getExecutionId(), row.getMachineId(), e.getMessage());
            return Optional.empty();
        }
    }

    private static String id(String executionId, String machineId) {
        return executionId + ":" + machineId;
    }

    public record RetryState(int retryCount, ScriptScheduleExecutionMessage message) {}
}
