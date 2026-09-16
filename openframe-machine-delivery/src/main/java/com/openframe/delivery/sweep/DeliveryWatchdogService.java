package com.openframe.delivery.sweep;

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
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.delivery.sweep.enabled", havingValue = "true")
public class DeliveryWatchdogService {

    private final MachineDeliveryRepository repository;
    private final DeliveryProperties properties;
    private final DeliveryCloser closer;
    private final DeliveryMetrics metrics;

    public void reapAcked() {
        Instant now = Instant.now();
        int batchSize = properties.getSweep().getBatchSize();
        List<MachineDelivery> silent = repository.findDue(DeliveryStatus.ACKED, now, batchSize);
        silent.forEach(delivery -> reapOne(delivery, now));
    }

    private void reapOne(MachineDelivery delivery, Instant now) {
        try {
            closer.fail(delivery, DeliveryFailure.TIMEOUT, DeliveryStatus.AWAITING_RESULT, now);
        } catch (Exception e) {
            metrics.recordRowError();
            backOff(delivery, now);
            log.error("Delivery watchdog failed for row, postponed: id={}", delivery.getId(), e);
        }
    }

    private void backOff(MachineDelivery delivery, Instant now) {
        try {
            DeliveryType type = delivery.getType();
            Policy policy = properties.resolve(type);
            long delaySeconds = policy.getMaxRetryIntervalSeconds();
            Instant dueAt = now.plusSeconds(delaySeconds);
            String id = delivery.getId();
            Instant dispatchedAt = delivery.getDispatchedAt();
            repository.postpone(id, DeliveryStatus.AWAITING_RESULT, dispatchedAt, dueAt);
        } catch (Exception e) {
            log.error("Delivery watchdog could not postpone row: id={}", delivery.getId(), e);
        }
    }
}
