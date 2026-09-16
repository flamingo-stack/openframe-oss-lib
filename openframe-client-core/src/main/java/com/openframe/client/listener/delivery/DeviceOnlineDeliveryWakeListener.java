package com.openframe.client.listener.delivery;

import com.openframe.client.event.DeviceCameOnlineEvent;
import com.openframe.client.event.DeviceFirstConnectedEvent;
import com.openframe.data.document.device.Machine;
import com.openframe.delivery.track.DeliveryTracker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import static com.openframe.data.document.device.DeviceStatus.ONLINE;

@Slf4j
@Component
@RequiredArgsConstructor
public class DeviceOnlineDeliveryWakeListener {

    private final DeliveryTracker deliveryTracker;

    @EventListener
    public void onDeviceFirstConnected(DeviceFirstConnectedEvent event) {
        Machine machine = event.getMachine();
        if (isOnline(machine)) {
            wake(machine);
        }
    }

    @EventListener
    public void onDeviceCameOnline(DeviceCameOnlineEvent event) {
        Machine machine = event.getMachine();
        wake(machine);
    }

    // listeners of one event run in sequence on the publisher's thread: an exception here would also skip the
    // SaaS DEVICE_REGISTERED listener; parked rows re-check on their own within max-retry-interval anyway
    private void wake(Machine machine) {
        String machineId = machine.getMachineId();
        try {
            deliveryTracker.wake(machineId);
        } catch (RuntimeException e) {
            log.warn("Failed to wake parked deliveries, they re-check on their own: machineId={}", machineId, e);
        }
    }

    private static boolean isOnline(Machine machine) {
        return machine.getStatus() == ONLINE;
    }
}
