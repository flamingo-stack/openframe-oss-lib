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

    public void acknowledge(DeliveryType type, String targetId, String machineId) {
        String id = DeliveryId.of(type, targetId, machineId);
        Instant now = Instant.now();
        Policy policy = properties.resolve(type);
        long resultTimeoutSeconds = policy.getResultTimeoutSeconds();
        Instant resultDueAt = now.plusSeconds(resultTimeoutSeconds);
        boolean acked = repository.markAcked(id, DeliveryStatus.UNACKED, now, resultDueAt);
        if (acked) {
            log.info("Delivery ACKED: type={} targetId={} machineId={}", type, targetId, machineId);
        }
    }

    public void complete(DeliveryType type, String targetId, String machineId) {
        String id = DeliveryId.of(type, targetId, machineId);
        Instant now = Instant.now();
        Instant expiresAt = expiresAt(type, now);
        boolean done = repository.markDone(id, DeliveryStatus.COMPLETABLE, now, expiresAt);
        if (done) {
            log.info("Delivery DONE: type={} targetId={} machineId={}", type, targetId, machineId);
        }
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

    public void wake(String machineId) {
        Instant now = Instant.now();
        long woken = repository.wake(machineId, DeliveryStatus.UNACKED, now);
        if (woken > 0) {
            log.info("Delivery rows woken for retry: machineId={} count={}", machineId, woken);
        }
    }

    private Instant expiresAt(DeliveryType type, Instant now) {
        Policy policy = properties.resolve(type);
        long ttlSeconds = policy.getTtlSeconds();
        return now.plusSeconds(ttlSeconds);
    }
}
