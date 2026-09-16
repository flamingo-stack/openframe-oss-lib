package com.openframe.client.service.rmm.delivery;

import com.openframe.client.service.rmm.delivery.DeliveryProperties.Policy;
import com.openframe.data.document.rmm.delivery.DeliveryFailure;
import com.openframe.data.document.rmm.delivery.DeliveryKind;
import com.openframe.data.document.rmm.delivery.DeliveryStatus;
import com.openframe.data.document.rmm.delivery.MachineDelivery;
import com.openframe.data.repository.rmm.MachineDeliveryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.rmm.delivery.enabled", havingValue = "true")
public class DeliveryWatchdogService {

    private final MachineDeliveryRepository repository;
    private final DeliverySpecRegistry registry;
    private final DeliveryProperties properties;
    private final DeliveryFailureRecorder failureRecorder;

    public void reapAcked() {
        Instant now = Instant.now();
        Set<DeliveryKind> kinds = registry.kinds();
        kinds.forEach(kind -> reapAcked(kind, now));
    }

    private void reapAcked(DeliveryKind kind, Instant now) {
        Policy policy = properties.resolve(kind);
        Instant threshold = now.minusSeconds(policy.getResultTimeoutSeconds());
        List<MachineDelivery> silent = repository.findByKindAndStatusAndAckedAtBefore(kind, DeliveryStatus.ACKED, threshold);
        silent.forEach(delivery -> failureRecorder.fail(delivery, DeliveryFailure.TIMEOUT, now));
    }
}
