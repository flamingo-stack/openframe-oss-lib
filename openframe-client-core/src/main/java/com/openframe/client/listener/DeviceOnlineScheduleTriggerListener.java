package com.openframe.client.listener;

import com.openframe.client.event.DeviceCameOnlineEvent;
import com.openframe.client.event.DeviceFirstConnectedEvent;
import com.openframe.client.service.rmm.DeviceOnlineScheduleTriggerService;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Bridges the in-process ONLINE transitions to the DEVICE_ONLINE schedule trigger. With the
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
        triggerService.onDeviceOnline(event.getMachine());
    }

    @EventListener
    public void onDeviceFirstConnected(DeviceFirstConnectedEvent event) {
        Machine machine = event.getMachine();
        if (machine.getStatus() == DeviceStatus.ONLINE) {   // PENDING→ONLINE; skip PENDING→OFFLINE
            triggerService.onDeviceOnline(machine);
        }
    }
}
