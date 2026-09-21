package com.openframe.delivery;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import com.openframe.delivery.DeliveryProperties.Policy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.delivery.enabled", havingValue = "true")
public class DeliveryWatchdogService {

    private static final Sort OLDEST_ACK_FIRST = Sort.by("ackedAt");

    private final MachineDeliveryRepository repository;
    private final DeliverySpecRegistry registry;
    private final DeliveryProperties properties;
    private final DeliveryFailureRecorder failureRecorder;

    public void reapAcked() {
        Instant now = Instant.now();
        Set<DeliveryType> types = registry.types();
        types.forEach(type -> reapAcked(type, now));
    }

    private void reapAcked(DeliveryType type, Instant now) {
        Policy policy = properties.resolve(type);
        long resultTimeoutSeconds = policy.getResultTimeoutSeconds();
        Instant threshold = now.minusSeconds(resultTimeoutSeconds);
        int batchSize = policy.getBatchSize();
        Pageable batch = PageRequest.of(0, batchSize, OLDEST_ACK_FIRST);
        List<MachineDelivery> silent = repository.findByTypeAndStatusAndAckedAtBefore(type, DeliveryStatus.ACKED, threshold, batch);
        silent.forEach(delivery -> reapOne(delivery, now));
    }

    private void reapOne(MachineDelivery delivery, Instant now) {
        try {
            failureRecorder.fail(delivery, DeliveryFailure.TIMEOUT, now);
        } catch (RuntimeException e) {
            log.error("Delivery watchdog failed for row: id={}", delivery.getId(), e);
        }
    }
}
