package com.openframe.client.listener;

import com.openframe.client.event.DeviceCameOnlineEvent;
import com.openframe.client.service.rmm.DeviceOnlineScheduleTriggerService;
import com.openframe.data.document.device.Machine;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Bridges the in-process OFFLINE→ONLINE Spring event to the DEVICE_ONLINE schedule trigger.
 * Replaces the earlier NATS hop (client → {@code device.status.online} → management): with the
 * trigger and the schedule engine both in client-service, a plain {@code @EventListener}
 * dispatches directly, no cross-process broker in the way.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DeviceOnlineScheduleTriggerListener {

    private final DeviceOnlineScheduleTriggerService triggerService;

    @EventListener
    public void onDeviceCameOnline(DeviceCameOnlineEvent event) {
        Machine machine = event.getMachine();
        triggerService.onDeviceOnline(machine.getTenantId(), machine.getMachineId());
    }
}
