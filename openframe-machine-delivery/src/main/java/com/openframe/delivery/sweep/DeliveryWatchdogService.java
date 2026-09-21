package com.openframe.delivery.sweep;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import com.openframe.delivery.config.DeliveryProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.delivery.enabled", havingValue = "true")
public class DeliveryWatchdogService {

    private static final Sort OLDEST_DUE_FIRST = Sort.by("dueAt");

    private final MachineDeliveryRepository repository;
    private final DeliveryProperties properties;
    private final DeliveryFailureRecorder failureRecorder;

    public void reapAcked() {
        Instant now = Instant.now();
        int batchSize = properties.getSweep().getBatchSize();
        Pageable batch = PageRequest.of(0, batchSize, OLDEST_DUE_FIRST);
        List<MachineDelivery> silent = repository.findByStatusAndDueAtBefore(DeliveryStatus.ACKED, now, batch);
        silent.forEach(delivery -> reapOne(delivery, now));
    }

    private void reapOne(MachineDelivery delivery, Instant now) {
        try {
            failureRecorder.record(delivery, DeliveryFailure.TIMEOUT, now);
        } catch (RuntimeException e) {
            log.error("Delivery watchdog failed for row: id={}", delivery.getId(), e);
        }
    }
}
