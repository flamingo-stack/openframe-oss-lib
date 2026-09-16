package com.openframe.client.service.rmm.delivery;

import com.openframe.client.metrics.DeliveryMetrics;
import com.openframe.client.service.rmm.delivery.DeliveryProperties.Policy;
import com.openframe.data.document.rmm.delivery.DeliveryFailure;
import com.openframe.data.document.rmm.delivery.DeliveryKind;
import com.openframe.data.document.rmm.delivery.DeliveryStatus;
import com.openframe.data.document.rmm.delivery.MachineDelivery;
import com.openframe.data.repository.rmm.MachineDeliveryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.rmm.delivery.enabled", havingValue = "true")
public class DeliveryFailureRecorder {

    private final MachineDeliveryRepository repository;
    private final DeliverySpecRegistry registry;
    private final DeliveryProperties properties;
    private final DeliveryMetrics metrics;

    public void fail(MachineDelivery delivery, DeliveryFailure failure, Instant now) {
        DeliveryKind kind = delivery.getKind();
        Policy policy = properties.resolve(kind);
        long ttlSeconds = policy.getTtlSeconds();

        delivery.setStatus(DeliveryStatus.FAILED);
        delivery.setFailure(failure);
        delivery.setFinishedAt(now);
        delivery.setExpiresAt(now.plusSeconds(ttlSeconds));
        repository.save(delivery);

        metrics.recordFailed(kind, failure);
        DeliverySpec<?> spec = registry.require(kind);
        spec.onFailed(delivery, failure);
        log.warn("Delivery FAILED: kind={} targetId={} machineId={} attempts={} reason={}",
                kind, delivery.getTargetId(), delivery.getMachineId(), delivery.getAttempts(), failure);
    }
}
