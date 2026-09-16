package com.openframe.client.service.rmm.delivery;

import com.openframe.client.service.rmm.delivery.DeliveryProperties.Policy;
import com.openframe.data.document.rmm.delivery.DeliveryKind;
import com.openframe.data.document.rmm.delivery.DeliveryStatus;
import com.openframe.data.document.rmm.delivery.MachineDelivery;
import com.openframe.data.repository.rmm.MachineDeliveryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.rmm.delivery.enabled", havingValue = "true")
public class MongoDeliveryTracker implements DeliveryTracker {

    private final MachineDeliveryRepository repository;
    private final DeliveryProperties properties;

    @Override
    public void acknowledge(DeliveryKind kind, String targetId, String machineId) {
        String id = MachineDelivery.id(kind, targetId, machineId);
        repository.findById(id)
                .filter(MongoDeliveryTracker::isPending)
                .ifPresent(this::markAcked);
    }

    @Override
    public void complete(DeliveryKind kind, String targetId, String machineId) {
        String id = MachineDelivery.id(kind, targetId, machineId);
        repository.findById(id)
                .filter(MongoDeliveryTracker::isOpen)
                .ifPresent(this::markDone);
    }

    private void markAcked(MachineDelivery delivery) {
        Instant now = Instant.now();
        delivery.setStatus(DeliveryStatus.ACKED);
        delivery.setAckedAt(now);
        repository.save(delivery);
        log.info("Delivery ACKED: kind={} targetId={} machineId={}",
                delivery.getKind(), delivery.getTargetId(), delivery.getMachineId());
    }

    private void markDone(MachineDelivery delivery) {
        Instant now = Instant.now();
        Policy policy = properties.resolve(delivery.getKind());
        long ttlSeconds = policy.getTtlSeconds();
        delivery.setStatus(DeliveryStatus.DONE);
        delivery.setFinishedAt(now);
        delivery.setExpiresAt(now.plusSeconds(ttlSeconds));
        repository.save(delivery);
        log.info("Delivery DONE: kind={} targetId={} machineId={} attempts={}",
                delivery.getKind(), delivery.getTargetId(), delivery.getMachineId(), delivery.getAttempts());
    }

    private static boolean isPending(MachineDelivery delivery) {
        return delivery.getStatus() == DeliveryStatus.PENDING;
    }

    private static boolean isOpen(MachineDelivery delivery) {
        DeliveryStatus status = delivery.getStatus();
        return status == DeliveryStatus.PENDING || status == DeliveryStatus.ACKED;
    }
}
