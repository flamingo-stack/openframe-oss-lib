package com.openframe.delivery;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import com.openframe.delivery.DeliveryProperties.Policy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.delivery.enabled", havingValue = "true")
public class MongoDeliveryTracker implements DeliveryTracker {

    private final MachineDeliveryRepository repository;
    private final DeliveryProperties properties;

    @Override
    public void acknowledge(DeliveryType type, String targetId, String machineId) {
        String id = DeliveryId.of(type, targetId, machineId);
        Instant now = Instant.now();
        boolean acked = repository.markAcked(id, now);
        if (acked) {
            log.info("Delivery ACKED: type={} targetId={} machineId={}", type, targetId, machineId);
        }
    }

    @Override
    public void complete(DeliveryType type, String targetId, String machineId) {
        String id = DeliveryId.of(type, targetId, machineId);
        Instant now = Instant.now();
        Instant expiresAt = expiresAt(type, now);
        boolean done = repository.markDone(id, now, expiresAt);
        if (done) {
            log.info("Delivery DONE: type={} targetId={} machineId={}", type, targetId, machineId);
        }
    }

    @Override
    public void cancel(DeliveryType type, String targetId, String machineId) {
        String id = DeliveryId.of(type, targetId, machineId);
        Instant now = Instant.now();
        Instant expiresAt = expiresAt(type, now);
        boolean cancelled = repository.markCancelled(id, now, expiresAt);
        if (cancelled) {
            log.info("Delivery CANCELLED: type={} targetId={} machineId={}", type, targetId, machineId);
        }
    }

    @Override
    public void wake(String machineId) {
        Instant now = Instant.now();
        long woken = repository.wake(machineId, now);
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
