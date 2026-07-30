package com.openframe.client.listener;

import com.openframe.client.event.DeviceCameOnlineEvent;
import com.openframe.client.event.DeviceFirstConnectedEvent;
import com.openframe.client.service.rmm.DeviceOnlineScheduleTriggerService;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.service.rmm.CriteriaScheduleMaterializer;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class DeviceOnlineScheduleTriggerListenerTest {

    private static final String TENANT = "tenant-1";
    private static final String MACHINE = "m-1";

    @Mock private CriteriaScheduleMaterializer materializer;
    @Mock private DeviceOnlineScheduleTriggerService triggerService;

    @InjectMocks private DeviceOnlineScheduleTriggerListener listener;

    @Test
    @DisplayName("first connect (ONLINE): materialises the device into criteria schedules, THEN fires — in that order")
    void firstConnectedOnline_materialisesThenFires() {
        Machine machine = machine(DeviceStatus.ONLINE);

        listener.onDeviceFirstConnected(new DeviceFirstConnectedEvent(this, machine));

        InOrder order = inOrder(materializer, triggerService);
        order.verify(materializer).materializeForDevice(machine);
        order.verify(triggerService).onDeviceOnline(TENANT, MACHINE);
    }

    @Test
    @DisplayName("first connect that lands OFFLINE does nothing (device isn't online)")
    void firstConnectedOffline_noOp() {
        Machine machine = machine(DeviceStatus.OFFLINE);

        listener.onDeviceFirstConnected(new DeviceFirstConnectedEvent(this, machine));

        verifyNoInteractions(materializer, triggerService);
    }

    @Test
    @DisplayName("offline→online: just fires (criteria rows already materialised at registration)")
    void cameOnline_firesOnly() {
        Machine machine = machine(DeviceStatus.ONLINE);

        listener.onDeviceCameOnline(new DeviceCameOnlineEvent(this, machine));

        verify(triggerService).onDeviceOnline(TENANT, MACHINE);
        verifyNoInteractions(materializer);
    }

    private static Machine machine(DeviceStatus status) {
        Machine m = new Machine();
        m.setMachineId(MACHINE);
        m.setTenantId(TENANT);
        m.setStatus(status);
        return m;
    }
}
