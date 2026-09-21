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
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.delivery.enabled", havingValue = "true")
public class DeliveryCloser {

    private final MachineDeliveryRepository repository;
    private final DeliverySpecRegistry registry;
    private final DeliveryProperties properties;
    private final DeliveryMetrics metrics;

    public void fail(MachineDelivery delivery, DeliveryFailure failure, Set<DeliveryStatus> from, Instant now) {
        DeliveryType type = delivery.getType();
        DeliverySpec<DeliverySeed, Object> spec = registry.require(type);
        Instant expiresAt = expiresAt(type, now);
        String id = delivery.getId();

        boolean stillIn = repository.markFailed(id, from, failure, now, expiresAt);
        if (!stillIn) {
            log.debug("Delivery moved on before the failure could be recorded: id={}", id);
            return;
        }
        delivery.setStatus(DeliveryStatus.FAILED);
        delivery.setFailure(failure);
        delivery.setFinishedAt(now);
        delivery.setExpiresAt(expiresAt);

        metrics.recordFailed(type, failure);
        spec.onFailed(delivery, failure);
        log.warn("Delivery FAILED: type={} targetId={} machineId={} attempts={} reason={}",
                type, delivery.getTargetId(), delivery.getMachineId(), delivery.getAttempts(), failure);
    }

    public void cancel(MachineDelivery delivery, Set<DeliveryStatus> from, String reason, Instant now) {
        DeliveryType type = delivery.getType();
        Instant expiresAt = expiresAt(type, now);
        boolean cancelled = repository.markCancelled(delivery.getId(), from, now, expiresAt);
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
