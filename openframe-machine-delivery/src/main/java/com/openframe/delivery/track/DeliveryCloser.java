package com.openframe.delivery.track;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.config.DeliveryProperties.Policy;
import com.openframe.delivery.metrics.DeliveryMetrics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Optional;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class DeliveryCloser {

    private final MachineDeliveryRepository repository;
    private final DeliveryProperties properties;
    private final DeliveryMetrics metrics;
    private final ApplicationEventPublisher eventPublisher;

    public void fail(MachineDelivery delivery, DeliveryFailure failure, Set<DeliveryStatus> from, Instant now) {
        DeliveryType type = delivery.getType();
        Policy policy = properties.resolve(type);
        String id = delivery.getId();
        Instant dispatchedAt = delivery.getDispatchedAt();
        int reruns = delivery.getReruns();
        if (isRerunDue(failure, policy, reruns)) {
            Instant dueAt = rerunAt(policy, now);
            boolean scheduled = repository.scheduleRerun(id, from, dispatchedAt, reruns, dueAt);
            if (scheduled) {
                rerunScheduled(delivery, failure, dueAt);
            } else {
                log.debug("Delivery moved on before its re-run could be scheduled: id={}", id);
            }
            return;
        }
        Instant expiresAt = expiresAt(type, now);

        boolean stillIn = repository.markFailed(id, from, dispatchedAt, failure, now, expiresAt);
        if (!stillIn) {
            log.debug("Delivery moved on before the failure could be recorded: id={}", id);
            return;
        }
        delivery.setStatus(DeliveryStatus.FAILED);
        delivery.setFailure(failure);
        delivery.setFinishedAt(now);
        delivery.setExpiresAt(expiresAt);

        String targetId = delivery.getTargetId();
        String machineId = delivery.getMachineId();
        metrics.recordFailed(type, failure);
        log.warn("Delivery FAILED: type={} targetId={} machineId={} attempts={} reason={}",
                type, targetId, machineId, delivery.getAttempts(), failure);
        eventPublisher.publishEvent(new DeliveryFailedEvent(type, targetId, machineId, failure));
    }

    public void failReported(DeliveryType type, String targetId, String machineId, String dispatchId, String error, Instant now) {
        String id = DeliveryId.of(type, targetId, machineId);
        Policy policy = properties.resolve(type);
        Optional<MachineDelivery> rerunnable = findRerunnable(id, policy);
        rerunnable.ifPresent(delivery -> scheduleAgentRerun(delivery, policy, dispatchId, error, now));
        if (rerunnable.isPresent()) {
            return;
        }
        Instant expiresAt = expiresAt(type, now);
        boolean stillOpen = repository.markFailed(id, dispatchId, DeliveryStatus.OPEN, DeliveryFailure.AGENT_ERROR, error, now, expiresAt);
        if (!stillOpen) {
            log.debug("Delivery failure from agent ignored, no open row for this dispatch: id={} dispatchId={}", id, dispatchId);
            return;
        }
        metrics.recordFailed(type, DeliveryFailure.AGENT_ERROR);
        log.warn("Delivery FAILED by agent: type={} targetId={} machineId={} dispatchId={} error={}",
                type, targetId, machineId, dispatchId, error);
        eventPublisher.publishEvent(new DeliveryFailedEvent(type, targetId, machineId, DeliveryFailure.AGENT_ERROR));
    }

    public void cancel(MachineDelivery delivery, Set<DeliveryStatus> from, String reason, Instant now) {
        DeliveryType type = delivery.getType();
        Instant expiresAt = expiresAt(type, now);
        Instant dispatchedAt = delivery.getDispatchedAt();
        String id = delivery.getId();
        boolean cancelled = repository.markCancelled(id, from, dispatchedAt, now, expiresAt);
        if (cancelled) {
            log.info("Delivery CANCELLED: type={} targetId={} machineId={} reason={}",
                    type, delivery.getTargetId(), delivery.getMachineId(), reason);
        }
    }

    // the primary is read only when the policy allows a second run at all
    private Optional<MachineDelivery> findRerunnable(String id, Policy policy) {
        if (isSingleRun(policy)) {
            return Optional.empty();
        }
        return repository.findByIdOnPrimary(id).filter(delivery -> policy.hasRunsLeft(delivery.getReruns()));
    }

    private void scheduleAgentRerun(MachineDelivery delivery, Policy policy, String dispatchId, String error, Instant now) {
        String id = delivery.getId();
        int reruns = delivery.getReruns();
        Instant dueAt = rerunAt(policy, now);
        boolean scheduled = repository.scheduleRerun(id, dispatchId, DeliveryStatus.OPEN, reruns, dueAt);
        if (!scheduled) {
            log.debug("Delivery failure from agent ignored, no published row of this dispatch: id={} dispatchId={}", id, dispatchId);
            return;
        }
        delivery.setError(error);
        rerunScheduled(delivery, DeliveryFailure.AGENT_ERROR, dueAt);
    }

    private void rerunScheduled(MachineDelivery delivery, DeliveryFailure failure, Instant dueAt) {
        DeliveryType type = delivery.getType();
        int reruns = delivery.getReruns() + 1;
        int run = reruns + 1;
        delivery.setStatus(DeliveryStatus.PENDING);
        delivery.setAttempts(0);
        delivery.setReruns(reruns);
        delivery.setDueAt(dueAt);
        metrics.recordRerun(type, failure);
        log.warn("Delivery re-run scheduled: type={} targetId={} machineId={} reason={} error={} run={} dueAt={}",
                type, delivery.getTargetId(), delivery.getMachineId(), failure, delivery.getError(), run, dueAt);
    }

    private static boolean isRerunDue(DeliveryFailure failure, Policy policy, int reruns) {
        return canRerun(failure) && policy.hasRunsLeft(reruns);
    }

    private static boolean isSingleRun(Policy policy) {
        return policy.getMaxRuns() <= 1;
    }

    // an offline machine never had the run: the reconnect window, counted from the kept dispatchedAt, is the decision
    private static boolean canRerun(DeliveryFailure failure) {
        return failure != DeliveryFailure.OFFLINE;
    }

    private static Instant rerunAt(Policy policy, Instant now) {
        long rerunAfterSeconds = policy.getRerunAfterSeconds();
        return now.plusSeconds(rerunAfterSeconds);
    }

    private Instant expiresAt(DeliveryType type, Instant now) {
        Policy policy = properties.resolve(type);
        long ttlSeconds = policy.getTtlSeconds();
        return now.plusSeconds(ttlSeconds);
    }
}
