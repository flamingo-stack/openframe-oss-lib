package com.openframe.delivery.track;

import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.config.DeliveryProperties.Policy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Slf4j
@Service
@RequiredArgsConstructor
public class DeliveryTracker {

    private final MachineDeliveryRepository repository;
    private final DeliveryProperties properties;
    private final DeliveryCloser closer;

    public void acknowledge(DeliveryType type, String targetId, String machineId, String dispatchId) {
        String id = DeliveryId.of(type, targetId, machineId);
        Instant now = Instant.now();
        Policy policy = properties.resolve(type);
        long resultTimeoutSeconds = policy.getResultTimeoutSeconds();
        Instant resultDueAt = now.plusSeconds(resultTimeoutSeconds);
        boolean acked = repository.markAcked(id, dispatchId, DeliveryStatus.UNACKED, now, resultDueAt);
        if (acked) {
            log.info("Delivery ACKED: type={} targetId={} machineId={} dispatchId={}", type, targetId, machineId, dispatchId);
        } else {
            log.debug("Delivery ack ignored, no unacked row for this dispatch: id={} dispatchId={}", id, dispatchId);
        }
    }

    public void complete(DeliveryType type, String targetId, String machineId, String dispatchId) {
        String id = DeliveryId.of(type, targetId, machineId);
        Instant now = Instant.now();
        Instant expiresAt = expiresAt(type, now);
        boolean done = repository.markDone(id, dispatchId, DeliveryStatus.COMPLETABLE, now, expiresAt);
        if (done) {
            log.info("Delivery DONE: type={} targetId={} machineId={} dispatchId={}", type, targetId, machineId, dispatchId);
        } else {
            log.debug("Delivery completion ignored, no row for this dispatch: id={} dispatchId={}", id, dispatchId);
        }
    }

    public void fail(DeliveryType type, String targetId, String machineId, String dispatchId, String error) {
        Instant now = Instant.now();
        closer.failReported(type, targetId, machineId, dispatchId, error, now);
    }

    public void cancel(DeliveryType type, String targetId, String machineId) {
        String id = DeliveryId.of(type, targetId, machineId);
        Instant now = Instant.now();
        Instant expiresAt = expiresAt(type, now);
        boolean cancelled = repository.markCancelled(id, DeliveryStatus.OPEN, now, expiresAt);
        if (cancelled) {
            log.info("Delivery CANCELLED: type={} targetId={} machineId={}", type, targetId, machineId);
        }
    }

    private Instant expiresAt(DeliveryType type, Instant now) {
        Policy policy = properties.resolve(type);
        long ttlSeconds = policy.getTtlSeconds();
        return now.plusSeconds(ttlSeconds);
    }
}
