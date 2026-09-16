package com.openframe.delivery;

import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
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
        String id = MachineDelivery.id(type, targetId, machineId);
        repository.findById(id)
                .filter(MongoDeliveryTracker::isPending)
                .ifPresent(this::markAcked);
    }

    @Override
    public void complete(DeliveryType type, String targetId, String machineId) {
        String id = MachineDelivery.id(type, targetId, machineId);
        repository.findById(id)
                .filter(MongoDeliveryTracker::isOpen)
                .ifPresent(this::markDone);
    }

    private void markAcked(MachineDelivery delivery) {
        Instant now = Instant.now();
        delivery.setStatus(DeliveryStatus.ACKED);
        delivery.setAckedAt(now);
        repository.save(delivery);
        log.info("Delivery ACKED: type={} targetId={} machineId={}",
                delivery.getType(), delivery.getTargetId(), delivery.getMachineId());
    }

    private void markDone(MachineDelivery delivery) {
        Instant now = Instant.now();
        Policy policy = properties.resolve(delivery.getType());
        long ttlSeconds = policy.getTtlSeconds();
        delivery.setStatus(DeliveryStatus.DONE);
        delivery.setFinishedAt(now);
        delivery.setExpiresAt(now.plusSeconds(ttlSeconds));
        repository.save(delivery);
        log.info("Delivery DONE: type={} targetId={} machineId={} attempts={}",
                delivery.getType(), delivery.getTargetId(), delivery.getMachineId(), delivery.getAttempts());
    }

    private static boolean isPending(MachineDelivery delivery) {
        return delivery.getStatus() == DeliveryStatus.PENDING;
    }

    private static boolean isOpen(MachineDelivery delivery) {
        DeliveryStatus status = delivery.getStatus();
        return status == DeliveryStatus.PENDING || status == DeliveryStatus.ACKED;
    }
}
