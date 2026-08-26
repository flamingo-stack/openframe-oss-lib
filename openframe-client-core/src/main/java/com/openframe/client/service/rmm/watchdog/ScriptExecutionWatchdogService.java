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
import java.util.List;
import java.util.Map;

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

        List<ScriptExecution> stuck = findStuckRunning(now);
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

    private List<ScriptExecution> findStuckRunning(Instant now) {
        long coarseFloorSeconds = Math.min(graceSeconds, fallbackThresholdSeconds);
        return scriptExecutionRepository
                .findByStatusAndDispatchedAtBefore(ExecutionStatus.RUNNING, now.minusSeconds(coarseFloorSeconds))
                .stream()
                .filter(row -> isStuck(row, now))
                .toList();
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

    public void retryStuckQueuedDeliveries() {
        Instant now = Instant.now();

        Map<DeliveryKey, List<ScriptExecution>> deliveries = findStuckQueuedByDelivery(now);
        if (deliveries.isEmpty()) {
            return;
        }

        List<ScriptExecution> failed = deliveries.entrySet().stream()
                .flatMap(entry -> retryOrFail(entry.getKey(), entry.getValue(), now).stream())
                .toList();

        finalizeFailedDeliveries(failed);
    }

    private List<ScriptExecution> retryOrFail(DeliveryKey delivery, List<ScriptExecution> leaves, Instant now) {
        return retryStore.get(delivery.executionId(), delivery.machineId())
                .filter(state -> state.retryCount() < retrySize)
                .map(state -> retryDelivery(delivery, state))
                .orElseGet(() -> failDelivery(delivery, leaves, now));
    }

    private Map<DeliveryKey, List<ScriptExecution>> findStuckQueuedByDelivery(Instant now) {
        return scriptExecutionRepository
                .findByStatusAndDispatchedAtBefore(ExecutionStatus.QUEUED, now.minusSeconds(queuedThresholdSeconds))
                .stream()
                .filter(row -> row.getExecutionId() != null && row.getMachineId() != null)
                .collect(groupingBy(row -> new DeliveryKey(row.getExecutionId(), row.getMachineId())));
    }

    private List<ScriptExecution> retryDelivery(DeliveryKey delivery, RetryState state) {
        scriptScheduleNatsPublisher.publish(delivery.machineId(), state.message());
        int attempt = retryStore.incrementRetryCount(delivery.executionId(), delivery.machineId(), state);
        watchdogMetrics.recordDeliveryRetried(1);
        log.info("Retried QUEUED delivery: executionId={} machineId={} attempt={}/{}",
                delivery.executionId(), delivery.machineId(), attempt, retrySize);
        return List.of();
    }

    private List<ScriptExecution> failDelivery(DeliveryKey delivery, List<ScriptExecution> leaves, Instant now) {
        leaves.forEach(row -> markDeliveryFailed(row, now));
        retryStore.evict(delivery.executionId(), delivery.machineId());
        log.warn("QUEUED delivery exhausted: executionId={} machineId={} — {} leaf(s) FAILED (agent never received)",
                delivery.executionId(), delivery.machineId(), leaves.size());
        return leaves;
    }

    private void markDeliveryFailed(ScriptExecution row, Instant now) {
        row.setStatus(ExecutionStatus.FAILED);
        row.setStatusChangedAt(now);
        row.setFinishedAt(now);
        row.setError(DELIVERY_FAILED_ERROR_FORMAT.formatted(retrySize));
    }

    private void finalizeFailedDeliveries(List<ScriptExecution> failed) {
        if (failed.isEmpty()) {
            return;
        }
        scriptExecutionRepository.saveAll(failed);
        watchdogMetrics.recordDeliveryFailed(failed.size());
        finalizeAffectedScheduleHeaders(failed);
    }

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
}
