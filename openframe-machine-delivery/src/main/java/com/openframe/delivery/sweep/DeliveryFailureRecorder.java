package com.openframe.delivery.sweep;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.config.DeliveryProperties.Policy;
import com.openframe.delivery.metrics.DeliveryMetrics;
import com.openframe.delivery.spec.DeliverySeed;
import com.openframe.delivery.spec.DeliverySpec;
import com.openframe.delivery.spec.DeliverySpecRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.delivery.enabled", havingValue = "true")
public class DeliveryFailureRecorder {

    private final MachineDeliveryRepository repository;
    private final DeliverySpecRegistry registry;
    private final DeliveryProperties properties;
    private final DeliveryMetrics metrics;

    public void record(MachineDelivery delivery, DeliveryFailure failure, Instant now) {
        DeliveryType type = delivery.getType();
        Policy policy = properties.resolve(type);
        long ttlSeconds = policy.getTtlSeconds();
        Instant expiresAt = now.plusSeconds(ttlSeconds);
        String id = delivery.getId();

        boolean stillOpen = repository.markFailed(id, DeliveryStatus.OPEN, failure, now, expiresAt);
        if (!stillOpen) {
            log.debug("Delivery closed before the failure could be recorded: id={}", id);
            return;
        }
        delivery.setStatus(DeliveryStatus.FAILED);
        delivery.setFailure(failure);
        delivery.setFinishedAt(now);
        delivery.setExpiresAt(expiresAt);

        metrics.recordFailed(type, failure);
        DeliverySpec<DeliverySeed, Object> spec = registry.require(type);
        spec.onFailed(delivery, failure);
        log.warn("Delivery FAILED: type={} targetId={} machineId={} attempts={} reason={}",
                type, delivery.getTargetId(), delivery.getMachineId(), delivery.getAttempts(), failure);
    }
}
