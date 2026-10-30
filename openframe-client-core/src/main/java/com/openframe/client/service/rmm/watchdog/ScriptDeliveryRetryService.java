package com.openframe.client.service.rmm.watchdog;

import com.openframe.client.metrics.ScriptExecutionWatchdogMetrics;
import com.openframe.client.service.rmm.ScriptDeliveryRetryStore;
import com.openframe.client.service.rmm.ScriptDeliveryRetryStore.RetryState;
import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.delivery.track.DeliveryTracker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.toSet;

@Service
@RequiredArgsConstructor
@Slf4j
public class ScriptDeliveryRetryService {

    private static final String DELIVERY_FAILED_ERROR_FORMAT = "Agent could not receive the script after %d delivery attempt(s)";
    private static final String OFFLINE_ERROR_MESSAGE = "Target device is offline; script delivery skipped";
    private static final String RECONNECT_WINDOW_ERROR_MESSAGE = "Target device did not come online within the reconnect window";
    private static final String CANCELLED_ERROR_MESSAGE = "Script delivery was cancelled before the agent received it";
    private static final String ENGINE_FAILED_ERROR_FORMAT = "Script delivery failed: %s";

    private final ScriptExecutionRepository scriptExecutionRepository;
    private final ScheduleJobExecutionWatchdogService headerWatchdogService;
    private final ScriptExecutionWatchdogMetrics watchdogMetrics;
    private final ScriptDeliveryRetryStore retryStore;
    private final DeliveryRepublisherRegistry deliveryRepublisherRegistry;
    private final MachineRepository machineRepository;
    private final DeliveryTracker deliveryTracker;

    @Value("${openframe.rmm.execution.retry.size}")
    private int retrySize;

    @Value("${openframe.rmm.execution.queued.threshold-seconds}")
    private long queuedThresholdSeconds;

    public void retryStuckQueuedDeliveries() {
        Instant now = Instant.now();

        Map<DeliveryKey, List<ScriptExecution>> deliveries = findStuckQueuedByDelivery(now);
        if (deliveries.isEmpty()) {
            return;
        }

        Set<String> offlineMachineIds = offlineTargets(deliveries.keySet());
        List<ScriptExecution> failed = deliveries.entrySet().stream()
                .flatMap(entry -> settle(entry.getKey(), entry.getValue(), now, offlineMachineIds).stream())
                .toList();

        finalizeFailedDeliveries(failed);
    }

    private Set<String> offlineTargets(Set<DeliveryKey> deliveries) {
        Set<String> machineIds = deliveries.stream().map(DeliveryKey::machineId).collect(toSet());
        return machineRepository.findByMachineIdInAndStatus(machineIds, DeviceStatus.OFFLINE).stream()
                .map(Machine::getMachineId)
                .collect(toSet());
    }

    // a batch the delivery engine carries has a row under the fire's executionId: the engine retries it and the leaves
    // follow the row. Without a row the batch went the way before the engine, retried from here
    private List<ScriptExecution> settle(DeliveryKey delivery, List<ScriptExecution> leaves, Instant now, Set<String> offlineMachineIds) {
        Optional<MachineDelivery> engineRow = deliveryTracker.find(DeliveryType.SCRIPT_SCHEDULE, delivery.executionId(), delivery.machineId());
        return engineRow
                .map(row -> followEngineRow(delivery, row, leaves, now, offlineMachineIds))
                .orElseGet(() -> retryOrFail(delivery, leaves, now, offlineMachineIds));
    }

    private List<ScriptExecution> followEngineRow(DeliveryKey delivery, MachineDelivery row, List<ScriptExecution> leaves, Instant now,
                                                  Set<String> offlineMachineIds) {
        return switch (row.getStatus()) {
            case PENDING, ACKED -> List.of();
            case DONE -> markReceived(delivery, leaves, now);
            case FAILED -> failByEngine(delivery, row, leaves, now);
            case CANCELLED -> failCancelled(delivery, leaves, now, offlineMachineIds);
        };
    }

    // the agent reported the batch and the row closed, the leaves did not move with it: they move now
    private List<ScriptExecution> markReceived(DeliveryKey delivery, List<ScriptExecution> leaves, Instant now) {
        leaves.forEach(row -> markRunning(row, now));
        scriptExecutionRepository.saveAll(leaves);
        retryStore.evict(delivery.executionId(), delivery.machineId());
        log.info("QUEUED leaves of a received delivery moved to RUNNING: executionId={} machineId={} leaves={}",
                delivery.executionId(), delivery.machineId(), leaves.size());
        return List.of();
    }

    private List<ScriptExecution> failByEngine(DeliveryKey delivery, MachineDelivery row, List<ScriptExecution> leaves, Instant now) {
        DeliveryFailure failure = row.getFailure();
        log.warn("Delivery engine gave up on the batch: executionId={} machineId={} failure={} attempts={} — {} leaf(s) FAILED",
                delivery.executionId(), delivery.machineId(), failure, row.getAttempts(), leaves.size());
        if (failure == DeliveryFailure.OFFLINE) {
            watchdogMetrics.recordDeliveryFailedOffline(leaves);
            return failDelivery(delivery, leaves, now, RECONNECT_WINDOW_ERROR_MESSAGE);
        }
        watchdogMetrics.recordDeliveryFailedExhausted(leaves);
        return failDelivery(delivery, leaves, now, engineFailureText(row));
    }

    private static String engineFailureText(MachineDelivery row) {
        if (row.getFailure() == DeliveryFailure.EXHAUSTED) {
            return DELIVERY_FAILED_ERROR_FORMAT.formatted(row.getAttempts());
        }
        return ENGINE_FAILED_ERROR_FORMAT.formatted(row.getFailure());
    }

    private List<ScriptExecution> failCancelled(DeliveryKey delivery, List<ScriptExecution> leaves, Instant now, Set<String> offlineMachineIds) {
        if (offlineMachineIds.contains(delivery.machineId())) {
            return failOfflineDelivery(delivery, leaves, now);
        }
        log.info("Delivery cancelled before the agent received it: executionId={} machineId={} — {} leaf(s) FAILED",
                delivery.executionId(), delivery.machineId(), leaves.size());
        watchdogMetrics.recordDeliveryFailedExhausted(leaves);
        return failDelivery(delivery, leaves, now, CANCELLED_ERROR_MESSAGE);
    }

    private List<ScriptExecution> retryOrFail(DeliveryKey delivery, List<ScriptExecution> leaves, Instant now, Set<String> offlineMachineIds) {
        if (offlineMachineIds.contains(delivery.machineId())) {
            return failOfflineDelivery(delivery, leaves, now);
        }
        return retryStore.get(delivery.executionId(), delivery.machineId())
                .filter(state -> state.retryCount() < retrySize)
                .map(state -> retryDelivery(delivery, state))
                .orElseGet(() -> failExhaustedDelivery(delivery, leaves, now));
    }

    private Map<DeliveryKey, List<ScriptExecution>> findStuckQueuedByDelivery(Instant now) {
        return scriptExecutionRepository
                .findByStatusAndDispatchedAtBeforeAndPackageUpdateRequestIdIsNull(
                        ExecutionStatus.QUEUED, now.minusSeconds(queuedThresholdSeconds))
                .stream()
                .filter(row -> row.getExecutionId() != null && row.getMachineId() != null)
                .collect(groupingBy(row -> new DeliveryKey(row.getExecutionId(), row.getMachineId())));
    }

    private List<ScriptExecution> retryDelivery(DeliveryKey delivery, RetryState state) {
        deliveryRepublisherRegistry.get(state.channel()).republish(delivery.machineId(), state.messageJson());
        int attempt = retryStore.incrementRetryCount(delivery.executionId(), delivery.machineId(), state);
        watchdogMetrics.recordDeliveryRetried(1);
        log.info("Retried QUEUED delivery: executionId={} machineId={} attempt={}/{}",
                delivery.executionId(), delivery.machineId(), attempt, retrySize);
        return List.of();
    }

    private List<ScriptExecution> failExhaustedDelivery(DeliveryKey delivery, List<ScriptExecution> leaves, Instant now) {
        log.warn("QUEUED delivery exhausted: executionId={} machineId={} — {} leaf(s) FAILED (agent never received)",
                delivery.executionId(), delivery.machineId(), leaves.size());
        watchdogMetrics.recordDeliveryFailedExhausted(leaves);
        return failDelivery(delivery, leaves, now, DELIVERY_FAILED_ERROR_FORMAT.formatted(retrySize));
    }

    private List<ScriptExecution> failOfflineDelivery(DeliveryKey delivery, List<ScriptExecution> leaves, Instant now) {
        log.info("QUEUED delivery skipped: device offline executionId={} machineId={} — {} leaf(s) FAILED",
                delivery.executionId(), delivery.machineId(), leaves.size());
        watchdogMetrics.recordDeliveryFailedOffline(leaves);
        return failDelivery(delivery, leaves, now, OFFLINE_ERROR_MESSAGE);
    }

    private List<ScriptExecution> failDelivery(DeliveryKey delivery, List<ScriptExecution> leaves, Instant now, String error) {
        leaves.forEach(row -> markDeliveryFailed(row, now, error));
        retryStore.evict(delivery.executionId(), delivery.machineId());
        return leaves;
    }

    private void markRunning(ScriptExecution row, Instant now) {
        row.setStatus(ExecutionStatus.RUNNING);
        row.setStatusChangedAt(now);
    }

    private void markDeliveryFailed(ScriptExecution row, Instant now, String error) {
        row.setStatus(ExecutionStatus.FAILED);
        row.setStatusChangedAt(now);
        row.setFinishedAt(now);
        row.setError(error);
    }

    private void finalizeFailedDeliveries(List<ScriptExecution> failed) {
        if (failed.isEmpty()) {
            return;
        }
        scriptExecutionRepository.saveAll(failed);
        headerWatchdogService.finalizeAffectedHeaders(failed);
    }
}
