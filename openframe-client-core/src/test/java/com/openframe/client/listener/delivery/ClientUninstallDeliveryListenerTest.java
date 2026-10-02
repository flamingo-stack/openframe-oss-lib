package com.openframe.client.listener.delivery;

import com.openframe.client.service.MachineStatusService;
import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.delivery.event.DeliveryAckedEvent;
import com.openframe.delivery.event.DeliveryFailedEvent;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ClientUninstallDeliveryListenerTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String TARGET_ID = "openframe-client";
    private static final String DISPATCH_ID = "d-1";

    @Mock private MachineStatusService machineStatusService;

    @InjectMocks private ClientUninstallDeliveryListener listener;

    @Test
    void onAcked_clientUninstall_deletionMarkedAcknowledged() {
        // execution
        listener.onAcked(new DeliveryAckedEvent(this, DeliveryType.CLIENT_UNINSTALL, TARGET_ID, MACHINE_ID, DISPATCH_ID));

        // verifications
        verify(machineStatusService).markDeletionAcknowledged(MACHINE_ID);
    }

    @Test
    void onAcked_otherType_ignored() {
        // execution
        listener.onAcked(new DeliveryAckedEvent(this, DeliveryType.TOOL_INSTALLATION, "fleetmdm-agent", MACHINE_ID, DISPATCH_ID));

        // verifications
        verifyNoInteractions(machineStatusService);
    }

    @Test
    void onFailed_clientUninstall_pendingDeletionCancelled() {
        // setup
        when(machineStatusService.cancelPendingDeletion(MACHINE_ID)).thenReturn(true);

        // execution
        listener.onFailed(new DeliveryFailedEvent(this, DeliveryType.CLIENT_UNINSTALL, TARGET_ID, MACHINE_ID, DISPATCH_ID,
                DeliveryFailure.TIMEOUT, null));

        // verifications
        verify(machineStatusService).cancelPendingDeletion(MACHINE_ID);
    }

    @Test
    void onFailed_otherType_ignored() {
        // execution
        listener.onFailed(new DeliveryFailedEvent(this, DeliveryType.TOOL_INSTALLATION, "fleetmdm-agent", MACHINE_ID, DISPATCH_ID,
                DeliveryFailure.EXHAUSTED, null));

        // verifications
        verifyNoInteractions(machineStatusService);
    }
}
