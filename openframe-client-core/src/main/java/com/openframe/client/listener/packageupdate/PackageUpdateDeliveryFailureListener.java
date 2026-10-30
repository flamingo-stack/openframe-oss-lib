package com.openframe.client.listener.packageupdate;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.delivery.PackageUpdateDeliverySeed;
import com.openframe.delivery.track.DeliveryFailedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Closes a device's package update whose order never reached it, so the software action finishes.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = {"openframe.rmm.software.enabled", "openframe.rmm.software.package-update.enabled"}, havingValue = "true")
@RequiredArgsConstructor
public class PackageUpdateDeliveryFailureListener {

    private final PackageUpdateStatusProcessor processor;

    @EventListener
    public void onDeliveryFailed(DeliveryFailedEvent event) {
        if (event.type() != DeliveryType.PACKAGE_UPDATE) {
            return;
        }
        String targetId = event.targetId();
        String machineId = event.machineId();
        // the WAIT order is already on the device and still installs once the app closes
        if (PackageUpdateDeliverySeed.isDeadlineTarget(targetId)) {
            log.warn("[package-update] deadline force not delivered targetId={} machineId={} reason={}",
                    targetId, machineId, event.failure());
            return;
        }
        // runs inside the delivery sweep or the delivery.result listener: a failure here must not reach them
        try {
            processor.failUndelivered(machineId, targetId, event.failure());
        } catch (Exception e) {
            log.error("[package-update] could not close the undelivered order requestId={} machineId={}", targetId, machineId, e);
        }
    }
}
