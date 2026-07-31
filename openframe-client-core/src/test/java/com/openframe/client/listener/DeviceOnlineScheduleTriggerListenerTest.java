package com.openframe.client.listener;

import com.openframe.client.event.DeviceCameOnlineEvent;
import com.openframe.client.event.DeviceFirstConnectedEvent;
import com.openframe.client.service.rmm.DeviceOnlineScheduleTriggerService;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class DeviceOnlineScheduleTriggerListenerTest {

    @Mock private DeviceOnlineScheduleTriggerService triggerService;

    @InjectMocks private DeviceOnlineScheduleTriggerListener listener;

    @Test
    @DisplayName("offline→online event routes the machine to the trigger service")
    void cameOnline_triggers() {
        Machine machine = machine(DeviceStatus.ONLINE);
        listener.onDeviceCameOnline(new DeviceCameOnlineEvent(this, machine));
        verify(triggerService).onDeviceOnline(machine);
    }

    @Test
    @DisplayName("first connect that lands ONLINE triggers (fresh device joins its criteria schedules)")
    void firstConnectedOnline_triggers() {
        Machine machine = machine(DeviceStatus.ONLINE);
        listener.onDeviceFirstConnected(new DeviceFirstConnectedEvent(this, machine));
        verify(triggerService).onDeviceOnline(machine);
    }

    @Test
    @DisplayName("first connect that lands OFFLINE does not trigger (device isn't online)")
    void firstConnectedOffline_noTrigger() {
        Machine machine = machine(DeviceStatus.OFFLINE);
        listener.onDeviceFirstConnected(new DeviceFirstConnectedEvent(this, machine));
        verifyNoInteractions(triggerService);
    }

    private static Machine machine(DeviceStatus status) {
        Machine m = new Machine();
        m.setMachineId("m-1");
        m.setTenantId("tenant-1");
        m.setStatus(status);
        return m;
    }
}
