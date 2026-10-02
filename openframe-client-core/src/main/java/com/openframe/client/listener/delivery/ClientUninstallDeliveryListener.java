package com.openframe.client.listener.delivery;

import com.openframe.client.service.MachineStatusService;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.delivery.event.DeliveryAckedEvent;
import com.openframe.delivery.event.DeliveryFailedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

// what a client uninstall delivery means for the machine document; the engine itself knows nothing about machines
@Slf4j
@Component
@RequiredArgsConstructor
public class ClientUninstallDeliveryListener {

    private final MachineStatusService machineStatusService;

    @EventListener
    public void onAcked(DeliveryAckedEvent event) {
        if (event.getType() != DeliveryType.CLIENT_UNINSTALL) {
            return;
        }
        machineStatusService.markDeletionAcknowledged(event.getMachineId());
    }

    @EventListener
    public void onFailed(DeliveryFailedEvent event) {
        if (event.getType() != DeliveryType.CLIENT_UNINSTALL) {
            return;
        }
        String machineId = event.getMachineId();
        boolean handedBack = machineStatusService.cancelPendingDeletion(machineId);
        if (handedBack) {
            log.error("Client uninstall failed after the agent acknowledged it, machine {} returned to OFFLINE: reason={} error={}",
                    machineId, event.getFailure(), event.getError());
        }
    }
}
