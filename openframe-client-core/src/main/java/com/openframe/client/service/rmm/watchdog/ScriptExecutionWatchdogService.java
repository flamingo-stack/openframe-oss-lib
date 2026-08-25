package com.openframe.client.service.rmm.watchdog;

import com.openframe.client.metrics.ScriptExecutionWatchdogMetrics;
import com.openframe.client.service.rmm.ScriptDeliveryRetryStore;
import com.openframe.client.service.rmm.ScriptDeliveryRetryStore.RetryState;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.nats.rmm.publisher.ScriptScheduleNatsPublisher;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static java.util.stream.Collectors.groupingBy;

@Service
@RequiredArgsConstructor
@Slf4j
public class ScriptExecutionWatchdogService {

    private static final String STUCK_ERROR_MESSAGE_FORMAT = "No result received within %d seconds; watchdog marked execution as failed";
    private static final String DELIVERY_FAILED_ERROR_FORMAT = "Agent could not receive the script after %d delivery attempt(s)";

    private final ScriptExecutionRepository scriptExecutionRepository;
    private final ScheduleJobExecutionWatchdogService headerWatchdogService;
    private final ScriptExecutionWatchdogMetrics watchdogMetrics;
    private final ScriptDeliveryRetryStore retryStore;
    private final ScriptScheduleNatsPublisher scriptScheduleNatsPublisher;

    @Value("${openframe.rmm.execution.watchdog.grace-seconds:120}")
    private long graceSeconds;

    @Value("${openframe.rmm.execution.watchdog.threshold-seconds:600}")
    private long fallbackThresholdSeconds;

    @Value("${openframe.rmm.execution.retry.size}")
    private int retrySize;

    @Value("${openframe.rmm.execution.queued.threshold-seconds}")
    private long queuedThresholdSeconds;

    public void markStuckExecutionsAsFailed() {
        Instant now = Instant.now();

        // Coarse, index-backed pre-filter: no RUNNING row can be stuck before the
        // smallest possible per-row threshold elapses. Refine precisely in memory.
        long coarseFloorSeconds = Math.min(graceSeconds, fallbackThresholdSeconds);
        List<ScriptExecution> candidates = scriptExecutionRepository.findByStatusAndDispatchedAtBefore(
                ExecutionStatus.RUNNING, now.minusSeconds(coarseFloorSeconds));

        List<ScriptExecution> stuck = candidates.stream()
                .filter(row -> isStuck(row, now))
                .toList();
        if (stuck.isEmpty()) {
            log.debug("No stuck Execution rows found");
            return;
        }

        log.info("Found {} stuck Execution row(s) — transitioning to FAILED", stuck.size());
        stuck.forEach(row -> markFailing(row, now));
        scriptExecutionRepository.saveAll(stuck);
        watchdogMetrics.recordScriptReaped(stuck.size());

        log.info("Marked {} Execution row(s) as FAILED", stuck.size());

        finalizeAffectedScheduleHeaders(stuck);
    }

    public void retryStuckQueuedDeliveries() {
        Instant now = Instant.now();
        List<ScriptExecution> queued = scriptExecutionRepository.findByStatusAndDispatchedAtBefore(
                ExecutionStatus.QUEUED, now.minusSeconds(queuedThresholdSeconds));
        if (queued.isEmpty()) {
            return;
        }

        Map<DeliveryKey, List<ScriptExecution>> byDelivery = queued.stream()
                .filter(r -> r.getExecutionId() != null && r.getMachineId() != null)
                .collect(groupingBy(r -> new DeliveryKey(r.getExecutionId(), r.getMachineId())));

        List<ScriptExecution> failed = new ArrayList<>();
        for (Map.Entry<DeliveryKey, List<ScriptExecution>> e : byDelivery.entrySet()) {
            DeliveryKey key = e.getKey();
            Optional<RetryState> state = retryStore.get(key.executionId(), key.machineId());

            if (state.isPresent() && state.get().retryCount() < retrySize) {
                scriptScheduleNatsPublisher.publish(key.machineId(), state.get().message());
                int attempt = retryStore.incrementRetryCount(key.executionId(), key.machineId(), state.get());
                watchdogMetrics.recordDeliveryRetried(1);
                log.info("Retried QUEUED delivery: executionId={} machineId={} attempt={}/{}",
                        key.executionId(), key.machineId(), attempt, retrySize);
            } else {
                e.getValue().forEach(row -> markDeliveryFailed(row, now));
                failed.addAll(e.getValue());
                retryStore.evict(key.executionId(), key.machineId());
                log.warn("QUEUED delivery exhausted: executionId={} machineId={} — {} leaf(s) FAILED (agent never received)",
                        key.executionId(), key.machineId(), e.getValue().size());
            }
        }

        if (!failed.isEmpty()) {
            scriptExecutionRepository.saveAll(failed);
            watchdogMetrics.recordDeliveryFailed(failed.size());
            finalizeAffectedScheduleHeaders(failed);
        }
    }

    private void markDeliveryFailed(ScriptExecution row, Instant now) {
        row.setStatus(ExecutionStatus.FAILED);
        row.setStatusChangedAt(now);
        row.setFinishedAt(now);
        row.setError(DELIVERY_FAILED_ERROR_FORMAT.formatted(retrySize));
    }

    private record DeliveryKey(String executionId, String machineId) {}

    private void finalizeAffectedScheduleHeaders(List<ScriptExecution> reaped) {
        reaped.stream()
                .filter(row -> row.getScheduleId() != null
                        && row.getTenantId() != null
                        && row.getExecutionId() != null)
                .map(row -> Map.entry(row.getTenantId(), row.getExecutionId()))
                .distinct()
                .forEach(e -> headerWatchdogService.finalizeIfSettled(e.getKey(), e.getValue()));
    }

    private boolean isStuck(ScriptExecution row, Instant now) {
        return row.getDispatchedAt() != null && row.getDispatchedAt().isBefore(now.minusSeconds(thresholdSecondsFor(row)));
    }

    private long thresholdSecondsFor(ScriptExecution row) {
        Integer timeout = row.getTimeoutSeconds();
        return timeout != null ? timeout + graceSeconds : fallbackThresholdSeconds;
    }

    private void markFailing(ScriptExecution row, Instant now) {
        long thresholdSeconds = thresholdSecondsFor(row);
        row.setStatus(ExecutionStatus.FAILED);
        row.setStatusChangedAt(now);
        row.setFinishedAt(now);
        row.setTimedOut(Boolean.TRUE);
        row.setError(STUCK_ERROR_MESSAGE_FORMAT.formatted(thresholdSeconds));
        log.info("Reaping stuck Execution: executionId={} machineId={} dispatchedAt={} thresholdSeconds={}",
                row.getExecutionId(), row.getMachineId(), row.getDispatchedAt(), thresholdSeconds);
    }
}
