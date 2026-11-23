package com.openframe.client.listener;

import com.openframe.client.service.ToolOsSupportReconciler;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.delivery.track.DeliveryDoneEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class ToolUninstallDoneListener {

    private final ToolOsSupportReconciler toolOsSupportReconciler;

    @EventListener
    public void onDeliveryDone(DeliveryDoneEvent event) {
        if (event.type() != DeliveryType.TOOL_UNINSTALL) {
            return;
        }
        String machineId = event.machineId();
        String toolAgentId = event.targetId();
        try {
            toolOsSupportReconciler.completeUninstall(machineId, toolAgentId);
        } catch (Exception e) {
            log.error("Could not drop the records of uninstalled {} on machine {}", toolAgentId, machineId, e);
        }
    }
}
