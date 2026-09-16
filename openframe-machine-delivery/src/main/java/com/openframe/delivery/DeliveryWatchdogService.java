package com.openframe.delivery;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import com.openframe.delivery.DeliveryProperties.Policy;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.delivery.enabled", havingValue = "true")
public class DeliveryWatchdogService {

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
        Instant threshold = now.minusSeconds(policy.getResultTimeoutSeconds());
        List<MachineDelivery> silent = repository.findByTypeAndStatusAndAckedAtBefore(type, DeliveryStatus.ACKED, threshold);
        silent.forEach(delivery -> failureRecorder.fail(delivery, DeliveryFailure.TIMEOUT, now));
    }
}
