package com.openframe.client.listener.packageadopt;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.delivery.track.DeliveryFailedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class PackageAdoptDeliveryFailureListener {

    private final PackageAdoptStatusProcessor packageAdoptStatusProcessor;

    @EventListener
    public void onDeliveryFailed(DeliveryFailedEvent event) {
        if (event.type() != DeliveryType.PACKAGE_ADOPT) {
            return;
        }
        String requestId = event.targetId();
        String machineId = event.machineId();
        DeliveryFailure failure = event.failure();
        // runs inside the delivery sweep or a NATS listener: a failure here must not reach them
        try {
            packageAdoptStatusProcessor.failUndelivered(machineId, requestId, failure);
        } catch (Exception e) {
            log.error("[package-adopt] could not mark the adoption failed requestId={} machineId={}", requestId, machineId, e);
        }
    }
}
