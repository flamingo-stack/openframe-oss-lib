package com.openframe.client.listener.delivery;

import com.openframe.client.event.DeviceCameOnlineEvent;
import com.openframe.client.event.DeviceFirstConnectedEvent;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.delivery.track.DeliveryTracker;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class DeviceOnlineDeliveryWakeListenerTest {

    private static final String MACHINE_ID = "machine-1";

    @Mock
    private DeliveryTracker deliveryTracker;

    @InjectMocks
    private DeviceOnlineDeliveryWakeListener listener;

    private Machine machine;

    @BeforeEach
    void setUp() {
        machine = new Machine();
        machine.setMachineId(MACHINE_ID);
    }

    @Test
    void onDeviceCameOnline_offlineToOnline_machineWoken() {
        // setup
        machine.setStatus(DeviceStatus.ONLINE);
        DeviceCameOnlineEvent event = new DeviceCameOnlineEvent(this, machine);

        // execution
        listener.onDeviceCameOnline(event);

        // verifications
        verify(deliveryTracker).wake(MACHINE_ID);
    }

    @Test
    void onDeviceFirstConnected_pendingToOnline_machineWoken() {
        // setup
        machine.setStatus(DeviceStatus.ONLINE);
        DeviceFirstConnectedEvent event = new DeviceFirstConnectedEvent(this, machine);

        // execution
        listener.onDeviceFirstConnected(event);

        // verifications
        verify(deliveryTracker).wake(MACHINE_ID);
    }

    @Test
    void onDeviceCameOnline_wakeFails_swallowedSoOtherListenersStillRun() {
        // setup
        machine.setStatus(DeviceStatus.ONLINE);
        DeviceCameOnlineEvent event = new DeviceCameOnlineEvent(this, machine);
        doThrow(new IllegalStateException("mongo down")).when(deliveryTracker).wake(MACHINE_ID);

        // execution + verifications
        assertThatCode(() -> listener.onDeviceCameOnline(event)).doesNotThrowAnyException();
    }

    @Test
    void onDeviceFirstConnected_pendingToOffline_nothingWoken() {
        // setup
        machine.setStatus(DeviceStatus.OFFLINE);
        DeviceFirstConnectedEvent event = new DeviceFirstConnectedEvent(this, machine);

        // execution
        listener.onDeviceFirstConnected(event);

        // verifications
        verifyNoInteractions(deliveryTracker);
    }
}
