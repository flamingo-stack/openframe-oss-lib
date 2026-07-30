package com.openframe.client.listener;

import com.openframe.client.event.DeviceCameOnlineEvent;
import com.openframe.client.event.DeviceFirstConnectedEvent;
import com.openframe.client.service.rmm.DeviceOnlineScheduleTriggerService;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.service.rmm.CriteriaScheduleMaterializer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Bridges the in-process ONLINE transitions to CRITERIA materialisation and the DEVICE_ONLINE
 * schedule trigger. Both run in one listener so ordering is deterministic — the device is first
 * materialised into its matching criteria schedules (join rows written), then the trigger fires,
 * reading those same rows.
 *
 * <ul>
 *   <li>{@link DeviceFirstConnectedEvent} — a freshly-registered device's first connect
 *       (PENDING→ONLINE): materialise it into every matching CRITERIA schedule, then fire. The
 *       PENDING→OFFLINE flavour is ignored (the device isn't online).</li>
 *   <li>{@link DeviceCameOnlineEvent} — an existing device going OFFLINE→ONLINE: just fire (its
 *       criteria rows were materialised at registration).</li>
 * </ul>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DeviceOnlineScheduleTriggerListener {

    private final CriteriaScheduleMaterializer criteriaScheduleMaterializer;
    private final DeviceOnlineScheduleTriggerService triggerService;

    @EventListener
    public void onDeviceFirstConnected(DeviceFirstConnectedEvent event) {
        Machine machine = event.getMachine();
        if (machine.getStatus() != DeviceStatus.ONLINE) {
            return;
        }
        criteriaScheduleMaterializer.materializeForDevice(machine);
        triggerService.onDeviceOnline(machine.getTenantId(), machine.getMachineId());
    }

    @EventListener
    public void onDeviceCameOnline(DeviceCameOnlineEvent event) {
        Machine machine = event.getMachine();
        triggerService.onDeviceOnline(machine.getTenantId(), machine.getMachineId());
    }
}
