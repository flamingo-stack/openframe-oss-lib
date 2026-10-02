package com.openframe.delivery.track;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.config.DeliveryProperties.Policy;
import com.openframe.delivery.event.DeliveryFailedEvent;
import com.openframe.delivery.metrics.DeliveryMetrics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class DeliveryCloser {

    private final MachineDeliveryRepository repository;
    private final ApplicationEventPublisher events;
    private final DeliveryProperties properties;
    private final DeliveryMetrics metrics;

    public void fail(MachineDelivery delivery, DeliveryFailure failure, Set<DeliveryStatus> from, Instant now) {
        DeliveryType type = delivery.getType();
        Instant expiresAt = expiresAt(type, now);
        String id = delivery.getId();
        Instant dispatchedAt = delivery.getDispatchedAt();

        boolean stillIn = repository.markFailed(id, from, dispatchedAt, failure, now, expiresAt);
        if (!stillIn) {
            log.debug("Delivery moved on before the failure could be recorded: id={}", id);
            return;
        }
        delivery.setStatus(DeliveryStatus.FAILED);
        delivery.setFailure(failure);
        delivery.setFinishedAt(now);
        delivery.setExpiresAt(expiresAt);

        metrics.recordFailed(type, failure);
        events.publishEvent(new DeliveryFailedEvent(this, type, delivery.getTargetId(), delivery.getMachineId(),
                delivery.getDispatchId(), failure, delivery.getError()));
        log.warn("Delivery FAILED: type={} targetId={} machineId={} attempts={} reason={}",
                type, delivery.getTargetId(), delivery.getMachineId(), delivery.getAttempts(), failure);
    }

    public void failReported(DeliveryType type, String targetId, String machineId, String dispatchId, String error, Instant now) {
        String id = DeliveryId.of(type, targetId, machineId);
        Instant expiresAt = expiresAt(type, now);
        boolean stillOpen = repository.markFailed(id, dispatchId, DeliveryStatus.OPEN, DeliveryFailure.AGENT_ERROR, error, now, expiresAt);
        if (!stillOpen) {
            log.debug("Delivery failure from agent ignored, no open row for this dispatch: id={} dispatchId={}", id, dispatchId);
            return;
        }
        metrics.recordFailed(type, DeliveryFailure.AGENT_ERROR);
        events.publishEvent(new DeliveryFailedEvent(this, type, targetId, machineId, dispatchId, DeliveryFailure.AGENT_ERROR, error));
        log.warn("Delivery FAILED by agent: type={} targetId={} machineId={} dispatchId={} error={}",
                type, targetId, machineId, dispatchId, error);
    }

    public void cancel(MachineDelivery delivery, Set<DeliveryStatus> from, String reason, Instant now) {
        DeliveryType type = delivery.getType();
        Instant expiresAt = expiresAt(type, now);
        Instant dispatchedAt = delivery.getDispatchedAt();
        String id = delivery.getId();
        boolean cancelled = repository.markCancelled(id, from, dispatchedAt, now, expiresAt);
        if (cancelled) {
            log.info("Delivery CANCELLED by sweep: type={} targetId={} machineId={} reason={}",
                    type, delivery.getTargetId(), delivery.getMachineId(), reason);
        }
    }

    private Instant expiresAt(DeliveryType type, Instant now) {
        Policy policy = properties.resolve(type);
        long ttlSeconds = policy.getTtlSeconds();
        return now.plusSeconds(ttlSeconds);
    }
}
